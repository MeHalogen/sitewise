import type { Adapter } from '../adapter.js';
import { getJSON } from '../http.js';

const API = 'https://api.coingecko.com/api/v3';

interface Market {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number | null;
}

function toCoin(m: Market) {
  return {
    id: m.id,
    symbol: m.symbol.toUpperCase(),
    name: m.name,
    price: m.current_price,
    marketCap: m.market_cap,
    change24h: m.price_change_percentage_24h ?? 0,
  };
}

const coinTable = (coins: ReturnType<typeof toCoin>[]) => ({
  columns: [
    { key: 'symbol', header: 'Symbol' },
    { key: 'name', header: 'Name', maxWidth: 24 },
    { key: 'priceFmt', header: 'Price (USD)', align: 'right' as const },
    { key: 'changeFmt', header: '24h %', align: 'right' as const },
    { key: 'capFmt', header: 'Market cap', align: 'right' as const },
  ],
  rows: coins.map((c) => ({
    ...c,
    priceFmt: c.price >= 1 ? c.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : c.price.toPrecision(4),
    changeFmt: `${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}%`,
    capFmt: `$${(c.marketCap / 1e9).toFixed(1)}B`,
  })),
});

export const crypto: Adapter = {
  name: 'crypto',
  description: 'Cryptocurrency prices and market data (CoinGecko, no key needed)',
  commands: [
    {
      name: 'top',
      description: 'Top coins by market cap',
      options: [{ flags: '-l, --limit <n>', description: 'number of coins', default: 10 }],
      async run(ctx) {
        const markets = await getJSON<Market[]>(
          `${API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Number(ctx.opts.limit)}&page=1`,
        );
        const coins = markets.map(toCoin);
        return { data: coins, table: coinTable(coins) };
      },
    },
    {
      name: 'price',
      description: 'Price of specific coins',
      example: ['bitcoin', 'ethereum'],
      args: [{ name: '<coins...>', description: 'CoinGecko ids, e.g. bitcoin ethereum solana' }],
      async run(ctx) {
        const ids = ctx.args.join(',');
        const markets = await getJSON<Market[]>(`${API}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}`);
        const coins = markets.map(toCoin);
        return { data: coins, table: coinTable(coins) };
      },
    },
  ],
};
