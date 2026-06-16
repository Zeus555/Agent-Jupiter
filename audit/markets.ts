// Asset -> reference-source mapping for the price audit.
//
// The agent reads the Jupiter *Perps* Mark Price (an oracle price) from the UI. We audit it
// against two independent references:
//   - Jupiter Price API v3 (spot USD price of the on-chain mint — what the user asked for).
//   - Pyth (the oracle family Jupiter Perps actually derives its mark from — apples-to-apples).
//
// CAVEAT: the Price API v3 prices the *wrapped* mint (wBTC, wormhole-ETH). For BTC the wrapped
// mint tracks spot tightly; for ETH the wormhole mint can depeg, so for ETH treat Pyth as the
// authoritative reference and v3 as informational.
export interface MarketRef {
    /** Solana mint queried on Jupiter Price API v3. */
    mint: string;
    /** Pyth price-feed id (hex, no 0x) for the matching <ASSET>/USD oracle. */
    pythFeed: string;
}

export const MARKETS: Record<string, MarketRef> = {
    WBTC: {
        mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
        pythFeed: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
    },
    SOL: {
        mint: 'So11111111111111111111111111111111111111112',
        pythFeed: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', // SOL/USD
    },
    ETH: {
        mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
        pythFeed: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
    },
};
