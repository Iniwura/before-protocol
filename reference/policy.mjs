// Independent dependency-free policy model. It does not execute or validate Solidity.
export class VaultPolicy {
  constructor({owner, recipient, perTransfer, dailyLimit}) {
    if (!owner || !recipient || perTransfer <= 0n || dailyLimit < perTransfer) throw Error('Invalid configuration');
    this.owner = owner;
    this.recipient = recipient;
    this.perTransfer = perTransfer;
    this.dailyLimit = dailyLimit;
    this.spent = 0n;
    this.day = null;
  }
  attempt({caller, recipient, amount, timestamp}) {
    if (caller !== this.owner) throw Error('Unauthorized');
    if (recipient !== this.recipient) throw Error('DestinationNotAllowed');
    if (amount <= 0n) throw Error('ZeroAmount');
    if (amount > this.perTransfer) throw Error('TransferTooLarge');
    const day = Math.floor(timestamp / 86400);
    const spent = day === this.day ? this.spent : 0n;
    if (amount > this.dailyLimit - spent) throw Error('DailyLimitExceeded');
    this.day = day;
    this.spent = spent + amount;
    return {day, total: this.spent};
  }
}
