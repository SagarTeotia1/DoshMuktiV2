import { env } from '../../../config/env';

// Ekart is booked through two seller accounts: 1 = prepaid, 2 = COD (the original account).
export type EkartAccount = 1 | 2;

export interface EkartAccountConfig {
  account: EkartAccount;
  clientId: string;
  username: string;
  password: string;
  pickupAlias: string;
  webhookToken: string;
}

export function ekartConfig(account: EkartAccount): EkartAccountConfig {
  return account === 1
    ? {
        account,
        clientId: env.EKART1_CLIENT_ID,
        username: env.EKART1_USERNAME,
        password: env.EKART1_PASSWORD,
        pickupAlias: env.EKART1_PICKUP_ALIAS,
        webhookToken: env.EKART1_WEBHOOK_TOKEN,
      }
    : {
        account,
        clientId: env.EKART_CLIENT_ID,
        username: env.EKART_USERNAME,
        password: env.EKART_PASSWORD,
        pickupAlias: env.EKART_PICKUP_ALIAS,
        webhookToken: env.EKART_WEBHOOK_TOKEN,
      };
}

// Shipments booked before accounts existed carry no marker and belong to account 2.
export function toEkartAccount(value: number | null | undefined): EkartAccount {
  return value === 1 ? 1 : 2;
}
