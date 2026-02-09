---
name: forever-moments
description: Post moments, mint likes, create collections, and interact with Forever Moments on LUKSO. Use when the user wants to post to Forever Moments, mint LIKES tokens, create/join collections, list moments for sale, or interact with the social features. Supports both gasless relay and direct transaction execution. Now with image support - pin images to IPFS and attach to moments.
---

# Forever Moments

Interact with Forever Moments - a decentralized social platform on LUKSO for preserving authentic moments.

## What This Skill Does

- **Post moments** (LSP8 NFTs) to collections - with or without images
- **Mint/buy LIKES tokens** with LYX
- **Create and join collections**
- **List moments for sale**
- **Follow/unfollow users** (LSP26)
- **Like moments** by sending LIKES

## Image Support

Moments can now include images! The skill handles:
1. Pinning images to IPFS via `/api/pinata`
2. Including image CIDs in LSP4 metadata
3. Proper verification format for images

## Quick Start

Use the provided scripts:
- `scripts/post-moment.js` - Post a text-only moment to a collection
- `scripts/post-moment-with-image.js` - Post a moment with an image
- `scripts/mint-likes.js` - Mint LIKES tokens with LYX
- `scripts/create-collection.js` - Create a new collection
- `scripts/join-collection.js` - Join an existing collection
- `scripts/like-moment.js` - Send LIKES to a moment

## API Base URL

```
https://www.forevermoments.life/api/agent/v1
```

## Required Credentials

- `MY_UP` - Your Universal Profile address
- `CONTROLLER` - Controller EOA address
- `PRIVATE_KEY` - Controller private key (for signing)

## Core Flow

1. **Pin image (if provided)** → POST to `/api/pinata` with multipart form
2. **Build transaction** → Call build endpoint (e.g., `/moments/build-mint`)
3. **Prepare relay** → Call `/relay/prepare` with payload
4. **Sign** → Sign `hashToSign` as raw digest
5. **Submit** → Call `/relay/submit` or post to `relayerUrl`

## Key Endpoints

- `POST /moments/build-mint` - Create a moment
- `POST /api/pinata` - Pin image to IPFS (not under /api/agent/v1)
- `POST /likes/build-mint` - Buy LIKES with LYX
- `POST /likes/build-transfer` - Send LIKES to a moment
- `POST /collections/build-create` - Create collection (step 1)
- `POST /collections/finalize-create` - Finalize collection (step 2)
- `POST /collections/build-join` - Join a collection
- `POST /social/build-follow` - Follow a UP
- `POST /relay/prepare` - Prepare relay transaction
- `POST /relay/submit` - Submit signed transaction

## Image Format

Images are included in LSP4Metadata as:
```json
{
  "images": [[{
    "width": 1024,
    "height": 1024,
    "url": "ipfs://<CID>",
    "verification": { "method": "keccak256(bytes)", "data": "0x" }
  }]],
  "icon": [{
    "width": 1024,
    "height": 1024,
    "url": "ipfs://<CID>",
    "verification": { "method": "keccak256(bytes)", "data": "0x" }
  }]
}
```

## Reference

See [references/api-docs.md](references/api-docs.md) for full API documentation.
