import { chainMeta, zip321Uri, type TokenDTO } from "@petrapay/shared";
import { evmPaymentUri } from "./wallets/evm";
import { solanaPaymentUri } from "./wallets/solana";

/** Best-effort wallet URI for the deposit QR. Falls back to the bare address. */
export function depositUri(token: TokenDTO | undefined, depositAddress: string, amountIn: string, amountInFormatted: string): string {
  if (!token) return depositAddress;
  const meta = chainMeta(token.blockchain);
  if (meta.wallet === "evm" && meta.evmChainId) {
    return evmPaymentUri({ chainId: meta.evmChainId, to: depositAddress, amount: amountIn, tokenAddress: token.contractAddress });
  }
  switch (token.blockchain) {
    case "sol":
      return solanaPaymentUri({ to: depositAddress, amountFormatted: amountInFormatted, mint: token.contractAddress });
    case "btc":
      return `bitcoin:${depositAddress}?amount=${amountInFormatted}`;
    case "ltc":
      return `litecoin:${depositAddress}?amount=${amountInFormatted}`;
    case "doge":
      return `dogecoin:${depositAddress}?amount=${amountInFormatted}`;
    case "zec":
      return zip321Uri({ address: depositAddress, amountZats: BigInt(amountIn) });
    default:
      return depositAddress;
  }
}
