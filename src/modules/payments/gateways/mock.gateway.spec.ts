import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentState } from '../enums/payment-state.enum';
import { MockGateway } from './mock.gateway';

const SECRET = 'test-secret';

function makeGateway(): MockGateway {
  const config = { get: () => SECRET } as unknown as ConfigService;
  return new MockGateway(config);
}

describe('MockGateway', () => {
  const ref = 'MOCK-abc';
  const txn = 'TXN-1';
  const amount = 200;

  it('initiate returns a pending charge with a redirect url', async () => {
    const result = await makeGateway().initiate({
      paymentId: 'abc',
      orderId: 'o1',
      amount,
      currency: 'BDT',
    });
    expect(result.status).toBe(PaymentState.PENDING);
    expect(result.gatewayReference).toBe('MOCK-abc');
    expect(result.redirectUrl).toContain('MOCK-abc');
  });

  it('accepts a correctly-signed SUCCESS webhook', async () => {
    const gw = makeGateway();
    const signature = MockGateway.sign(SECRET, ref, txn, 'SUCCESS', amount);
    const result = await gw.verifyCallback({
      gatewayReference: ref,
      gatewayTxnId: txn,
      status: 'SUCCESS',
      amount,
      signature,
    });
    expect(result.status).toBe(PaymentState.SUCCESS);
    expect(result.gatewayTxnId).toBe(txn);
  });

  it('maps a non-SUCCESS status to FAILED', async () => {
    const gw = makeGateway();
    const signature = MockGateway.sign(SECRET, ref, txn, 'FAILED', amount);
    const result = await gw.verifyCallback({
      gatewayReference: ref,
      gatewayTxnId: txn,
      status: 'FAILED',
      amount,
      signature,
    });
    expect(result.status).toBe(PaymentState.FAILED);
  });

  it('rejects a tampered signature', async () => {
    const gw = makeGateway();
    const signature = MockGateway.sign(SECRET, ref, txn, 'SUCCESS', amount);
    await expect(
      gw.verifyCallback({
        gatewayReference: ref,
        gatewayTxnId: txn,
        status: 'SUCCESS',
        amount: amount + 1, // amount changed → signature no longer matches
        signature,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fetchStatus reports SUCCESS for reconciliation', async () => {
    const result = await makeGateway().fetchStatus(ref);
    expect(result.status).toBe(PaymentState.SUCCESS);
    expect(result.gatewayTxnId).toBe(`${ref}-TXN`);
  });
});
