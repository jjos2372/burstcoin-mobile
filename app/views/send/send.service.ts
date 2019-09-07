
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Account, Attachment, EncryptedMessage, Keys, Message, Transaction, constants } from "../../lib/model";
import { AccountService, CryptoService } from "../../lib/services";

@Injectable()
export class SendService {
    private amount: number;
    private fee: number;
    private recipient: string;

    private message: string;
    private messageEncrypted: boolean;

    public constructor(
        private accountService: AccountService,
        private cryptoService: CryptoService
    ) {
        this.reset();
    }

    public reset() {
        this.recipient = "";
        this.amount = 0;
        this.fee = constants.defaultFee;

        this.message = ""
        this.messageEncrypted = false;
    }

    public setRecipient(recipient: string) {
        this.recipient = recipient;
    }

    public getRecipient(): string {
        return this.recipient
    }

    public setFee(fee: number) {
        this.fee = fee;
    }

    public getFee(): number {
        return this.fee;
    }

    public setAmount(amount: number) {
        this.amount = amount;
    }

    public getAmount(): number {
        return this.amount;
    }

    public getTotal(): number {
        return this.amount + this.fee;
    }

    public setMessage(message: string) {
        this.message = message;
    }

    public getMessageEnabled(): boolean {
        return this.message!=null && this.message.length>0;
    }

    public getMessage(): string {
        return this.message;
    }

    public setMessageEncrypted(encrypted: boolean) {
        this.messageEncrypted = encrypted;
    }

    public getMessageEncrypted(): boolean {
        return this.messageEncrypted;
    }

    public createTransaction(keys: Keys, pin: string): Promise<Transaction> {
        return new Promise((resolve, reject) => {
            let transaction = new Transaction()
            transaction.recipientAddress = this.recipient;
            transaction.senderPublicKey = keys.publicKey;
            transaction.amountNQT = this.amount;
            transaction.feeNQT = this.fee;
            if (this.message!=null && this.message.length > 0) {
                if (this.messageEncrypted) { // encrypted message
                    let em = new EncryptedMessage();
                    this.cryptoService.getAccountIdFromBurstAddress(this.recipient).then(
                        id => {
                            this.accountService.getAccountPublicKey(id).then(
                                publicKey => {
                                    this.cryptoService.encryptMessage(this.message, keys.agreementPrivateKey, this.accountService.hashPinEncryption(pin), publicKey).then(encrypted => {
                                        em.data = encrypted.m;
                                        em.nonce = encrypted.n;
                                        em.isText = true
                                        transaction.attachment = em
                                        resolve(transaction)
                                    })
                                }).catch(error => {
                                    reject(error)
                                })
                        })
                } else { // message
                    let m = new Message();
                    m.message = this.message;
                    m.messageIsText = true;
                    transaction.attachment = m;
                    resolve(transaction);
                }
            } else {
                resolve(transaction);
            }
        });

    }

}
