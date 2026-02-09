---
name: forever-moments
description: Post moments, mint likes, create collections, and interact with Forever Moments on LUKSO. Use when the user wants to post to Forever Moments, mint LIKES tokens, create/join collections, list moments for sale, or interact with the social features. Supports both gasless relay and direct transaction execution.
---

# Forever Moments

Interact with Forever Moments - a decentralized social platform on LUKSO for preserving authentic moments.

## What This Skill Does

- Post moments (LSP8 NFTs) to collections
- Mint/buy LIKES tokens
- Create and join collections
- List moments for sale
- Follow/unfollow users (LSP26)
- Like moments

## Quick Start

Use the provided scripts:
- `scripts/post-moment.js` - Post a new moment to a collection
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

1. **Build transaction** → Call build endpoint (e.g., `/moments/build-mint`)
2. **Prepare relay** → Call `/relay/prepare` with payload
3. **Sign** → Sign `hashToSign` as raw digest
4. **Submit** → Call `/relay/submit` or post to `relayerUrl`

## Key Endpoints

- `POST /moments/build-mint` - Create a moment
- `POST /likes/build-mint` - Buy LIKES with LYX
- `POST /likes/build-transfer` - Send LIKES to a moment
- `POST /collections/build-create` - Create collection (step 1)
- `POST /collections/finalize-create` - Finalize collection (step 2)
- `POST /collections/build-join` - Join a collection
- `POST /social/build-follow` - Follow a UP

## Reference

See [references/api-docs.md](references/api-docs.md) for full API documentation.
