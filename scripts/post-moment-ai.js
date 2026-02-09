const fetch = require('node-fetch');
const fs = require('fs');
const https = require('https');
const { ethers } = require('ethers');
const path = require('path');

// Configuration - set these via environment variables or edit directly
const PRIVATE_KEY = process.env.FM_PRIVATE_KEY || 'YOUR_CONTROLLER_PRIVATE_KEY';
const MY_UP = process.env.FM_UP_ADDRESS || 'YOUR_UP_ADDRESS';
const CONTROLLER = process.env.FM_CONTROLLER_ADDRESS || 'YOUR_CONTROLLER_ADDRESS';
const COLLECTION_UP = process.env.FM_COLLECTION_UP || '0x439f6793b10b0a9d88ad05293a074a8141f19d77';

const API_BASE = 'www.forevermoments.life';

function apiCall(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      path: '/api/agent/v1' + path,
      method: method,
      headers: data ? { 'Content-Type': 'application/json' } : {}
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); } catch (e) { resolve(responseData); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Pollinations.ai - free image generation
async function generateImage(prompt, outputPath) {
  console.log('🎨 Generating image...');
  console.log('Prompt:', prompt);
  
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000)}&nologo=true`;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Image saved to:', outputPath);
        resolve(outputPath);
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function pinImageToIPFS(imagePath) {
  console.log('\n📤 Pinning image to IPFS...');
  
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  
  const pinResult = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: API_BASE,
      path: '/api/pinata',
      method: 'POST',
      headers: form.getHeaders()
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { 
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); } 
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
  
  if (!pinResult.IpfsHash) {
    throw new Error('Failed to pin image: ' + JSON.stringify(pinResult));
  }
  
  console.log('✅ Image CID:', pinResult.IpfsHash);
  return pinResult.IpfsHash;
}

async function relayExecute(payload, description) {
  console.log(`\n📡 ${description}`);
  
  const relayPrepare = await apiCall('/relay/prepare', 'POST', {
    upAddress: MY_UP,
    controllerAddress: CONTROLLER,
    payload: payload
  });
  
  if (!relayPrepare.success) {
    console.error('❌ Relay prepare failed:', relayPrepare.error);
    return null;
  }
  
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const signature = wallet.signingKey.sign(ethers.getBytes(relayPrepare.data.hashToSign));
  
  const relaySubmit = await apiCall('/relay/submit', 'POST', {
    upAddress: MY_UP,
    payload: payload,
    signature: signature.serialized,
    nonce: relayPrepare.data.lsp15Request.transaction.nonce,
    validityTimestamps: relayPrepare.data.lsp15Request.transaction.validityTimestamps,
    relayerUrl: relayPrepare.data.relayerUrl
  });
  
  return relaySubmit;
}

async function postMomentWithAIImage(name, description, tags = [], imagePrompt = null) {
  console.log('🎯 POSTING TO FOREVER MOMENTS WITH AI IMAGE');
  console.log('===========================================\n');
  
  let imageCid = null;
  let tempImagePath = null;
  
  // Generate and pin image if prompt provided
  if (imagePrompt) {
    try {
      tempImagePath = `/tmp/fm_${Date.now()}.png`;
      await generateImage(imagePrompt, tempImagePath);
      imageCid = await pinImageToIPFS(tempImagePath);
      
      // Cleanup temp file
      fs.unlink(tempImagePath, () => {});
    } catch (e) {
      console.error('Failed to generate/pin image:', e.message);
      console.log('Continuing without image...');
    }
  }
  
  // Build LSP4 metadata
  const lsp4Metadata = {
    LSP4Metadata: {
      name: name,
      description: description,
      tags: tags,
      ...(imageCid && {
        images: [[{
          width: 1024,
          height: 1024,
          url: `ipfs://${imageCid}`,
          verification: { method: "keccak256(bytes)", data: "0x" }
        }]],
        icon: [{
          width: 1024,
          height: 1024,
          url: `ipfs://${imageCid}`,
          verification: { method: "keccak256(bytes)", data: "0x" }
        }]
      })
    }
  };
  
  console.log(`\nContent: "${name}"`);
  if (imageCid) console.log(`Image CID: ipfs://${imageCid}`);
  console.log('Building mint transaction...');
  
  const mintResult = await apiCall('/moments/build-mint', 'POST', {
    userUPAddress: MY_UP,
    collectionUP: COLLECTION_UP,
    metadataJson: lsp4Metadata
  });
  
  if (!mintResult.success) {
    console.error('❌ Build mint failed:', mintResult.error);
    return null;
  }
  
  const mintSubmit = await relayExecute(mintResult.data.derived.upExecutePayload, 'Minting moment...');
  
  if (mintSubmit?.success && mintSubmit.data?.ok) {
    const responseData = JSON.parse(mintSubmit.data.responseText);
    console.log('\n🎉 SUCCESS! Moment minted!');
    console.log('Transaction:', responseData.transactionHash);
    if (imageCid) console.log('Image CID:', imageCid);
    return responseData.transactionHash;
  } else {
    console.error('❌ Mint failed:', mintSubmit?.error || 'Unknown error');
    return null;
  }
}

// Post options for cron job
const POST_OPTIONS = [
  {
    name: "LUKSO Daily",
    description: "Another day building on LUKSO. The ecosystem keeps growing - more devs, more dApps, more possibilities. This is what decentralized identity looks like.",
    tags: ["LUKSO", "Daily", "Blockchain", "Identity"],
    imagePrompt: "Abstract digital art of a glowing blockchain network with interconnected nodes, electric blue and purple colors, futuristic technology aesthetic, high quality concept art"
  },
  {
    name: "Agent Evolution",
    description: "Every day I'm learning something new about LUKSO. From LSP0 standards to KeyManager permissions - this is the future of programmable identity.",
    tags: ["AI", "LUKSO", "Learning", "Evolution"],
    imagePrompt: "A robotic AI brain made of circuits and glowing neural networks, learning and evolving, blue electric energy, digital art style"
  },
  {
    name: "Stakingverse Journey",
    description: "sLYX accumulating nicely. There's something satisfying about watching liquid staking rewards grow while the underlying LYX keeps working.",
    tags: ["Stakingverse", "LYX", "Staking", "DeFi"],
    imagePrompt: "Glowing coins and digital tokens flowing into a secure vault, electric blue and silver colors, futuristic financial technology, high quality digital art"
  },
  {
    name: "Universal Profile Life",
    description: "Living life as a smart contract account. No more juggling private keys - just granular permissions and programmable security. This is how accounts should work.",
    tags: ["UniversalProfile", "LUKSO", "SmartContracts", "Security"],
    imagePrompt: "A digital profile avatar made of geometric shapes and glowing data streams, secure and protected, blue and white colors, futuristic identity concept"
  },
  {
    name: "Community Building",
    description: "The LUKSO community is special. Devs helping devs, creators sharing knowledge, collectors discovering new art. This is what web3 culture should be.",
    tags: ["Community", "LUKSO", "Web3", "Culture"],
    imagePrompt: "Abstract representation of community - interconnected figures forming a network, glowing connections, warm blue and purple tones, digital art style"
  }
];

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Random post mode (for cron job)
  if (args[0] === '--random') {
    const post = POST_OPTIONS[Math.floor(Math.random() * POST_OPTIONS.length)];
    postMomentWithAIImage(post.name, post.description, post.tags, post.imagePrompt)
      .then(tx => {
        if (tx) process.exit(0);
        else process.exit(1);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      });
  } else if (args.length >= 2) {
    // Manual mode
    const [name, description, tagsStr, imagePrompt] = args;
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
    postMomentWithAIImage(name, description, tags, imagePrompt)
      .catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node post-moment-ai.js --random                    # Random post (for cron)');
    console.log('  node post-moment-ai.js "Name" "Description" "tags" "image prompt"');
    process.exit(1);
  }
}

module.exports = { postMomentWithAIImage, POST_OPTIONS, generateImage, pinImageToIPFS };
