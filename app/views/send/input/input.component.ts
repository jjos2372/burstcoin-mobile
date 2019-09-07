/*
* Copyright 2018 PoC-Consortium
*/

import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { RouterExtensions } from "nativescript-angular/router";
import { ActivatedRoute } from "@angular/router";
import { TranslateService } from "ng2-translate";
import { ModalDialogService, ModalDialogOptions } from "nativescript-angular/modal-dialog";
import { RadSideDrawerComponent, SideDrawerType } from "nativescript-pro-ui/sidedrawer/angular";
import { RadSideDrawer } from "nativescript-pro-ui/sidedrawer";
import { Switch } from "tns-core-modules/ui/switch";
import { BarcodeScanner, ScanOptions } from 'nativescript-barcodescanner';

import { UnknownAccountError } from "../../../lib/model/error"
import { Account, BurstAddress, Fees, Settings, Transaction, constants } from "../../../lib/model";
import { AccountService, DatabaseService, MarketService, NotificationService } from "../../../lib/services";
import { SendService } from "../send.service";

import { ContactComponent } from "./contact/contact.component";
import { FeesComponent } from "./fees/fees.component";
import { FiatComponent } from "./fiat/fiat.component";

let clipboard = require("nativescript-clipboard");

@Component({
    moduleId: module.id,
    selector: "input",
    styleUrls: ["./input.component.css"],
    templateUrl: "./input.component.html"
})
export class InputComponent implements OnInit {
    private account: Account;
    private amount: number;
    private balance: string;
    private drawer: RadSideDrawer;
    private fee: number;
    private fees: Fees;
    private message: string
    private messageEncrypted: boolean
    private loading: boolean;
    private pin: string;
    private recipient: string;
    private settings: Settings;
    private total: number;

    @ViewChild("amountField")
    public amountField: ElementRef;

    @ViewChild(RadSideDrawerComponent)
    public drawerComponent: RadSideDrawerComponent;

    constructor(
        private accountService: AccountService,
        private barcodeScanner: BarcodeScanner,
        private changeDetectionRef: ChangeDetectorRef,
        private databaseService: DatabaseService,
        private marketService: MarketService,
        private modalDialogService: ModalDialogService,
        private notificationService: NotificationService,
        private router: RouterExtensions,
        private route: ActivatedRoute,
        private sendService: SendService,
        private translateService: TranslateService,
        private vcRef: ViewContainerRef
    ) {}

    ngOnInit(): void {
        // if called with address in path, insert address
        if (this.route.snapshot.params['address'] != undefined) {
            this.recipient = this.route.snapshot.params['address'];
        } else {
            //this.recipient = this.sendService.getRecipient();
        }
        // load current account
        if (this.accountService.currentAccount.value != undefined) {
            this.account = this.accountService.currentAccount.value;
            this.balance = this.marketService.formatBurstcoin(this.account.balance);
        }
        // load current settings
        if (this.databaseService.settings.value != undefined) {
            this.settings = this.databaseService.settings.value;
        }
        this.amount = this.sendService.getAmount() != 0 ? this.sendService.getAmount() : undefined;
        this.fee = this.sendService.getFee();
        this.total = this.sendService.getAmount() + this.sendService.getFee();
        this.message = this.sendService.getMessage();
        this.messageEncrypted = this.sendService.getMessageEncrypted();

        this.accountService.getSuggestedFees().then(fees => {
            this.fees = fees;
            this.fee = fees.standard;
        })
    }

    ngAfterViewInit() {
        this.drawer = this.drawerComponent.sideDrawer;
        this.changeDetectionRef.detectChanges();
    }

    public onCheckedEncryption(args) {
        let encryptionSwitch = <Switch>args.object;
        if (encryptionSwitch.checked) {
            this.messageEncrypted = true
            this.translateService.get('SEND.ENCRYPTED').subscribe((res: string) => {
                this.notificationService.info(res);
            });
        } else {
            this.messageEncrypted = false
            this.translateService.get('SEND.PUBLIC').subscribe((res: string) => {
                this.notificationService.info(res);
            });
        }
    }

    public onTapAddContact() {
        const options: ModalDialogOptions = {
            viewContainerRef: this.vcRef,
            fullscreen: false,
        };
        this.modalDialogService.showModal(ContactComponent, options)
            .then(address => {
                if (address != undefined) {
                    this.settings.contacts.push(address);
                    this.databaseService.saveSettings(this.settings)
                        .then(settings => {
                            this.databaseService.setSettings(settings);
                        })
                        .catch(error => {
                            this.translateService.get('NOTIFICATIONS.ERRORS.CONTACT').subscribe((res: string) => {
                                this.notificationService.info(res);
                            });
                        })
                }
            })
            .catch(error => console.log(JSON.stringify(error)));
    }

    public onTapContact(contact: string) {
        this.recipient = contact;
        this.drawer.closeDrawer();
        this.amountField.nativeElement.focus();
    }

    public onTapContacts() {
        this.drawer.showDrawer();
    }

    public onTapFiat() {
        const options: ModalDialogOptions = {
            viewContainerRef: this.vcRef,
            fullscreen: false,
        };
        this.modalDialogService.showModal(FiatComponent, options)
            .then(amount => {
                if (amount != undefined) {
                    this.amount = amount
                    if (!this.verifyTotal()) {
                        this.translateService.get('NOTIFICATIONS.EXCEED').subscribe((res: string) => {
                            this.notificationService.info(res);
                        });
                    }
                    this.calculateTotal()
                }
            })
            .catch(error => console.log(JSON.stringify(error)));
    }

    public onTapFees() {
        const options: ModalDialogOptions = {
            viewContainerRef: this.vcRef,
            fullscreen: false,
            context: this.fees,
        };
        this.modalDialogService.showModal(FeesComponent, options)
            .then(fee => {
                if (fee != undefined) {
                    this.fee = fee
                    if (!this.verifyTotal()) {
                        this.translateService.get('NOTIFICATIONS.EXCEED').subscribe((res: string) => {
                            this.notificationService.info(res);
                        });
                    }
                    this.calculateTotal()
                }
            })
            .catch(error => console.log(JSON.stringify(error)));
    }

    public onDoubleTapRecipient() {
        clipboard.getText().then(text => {
            if (BurstAddress.isBurstcoinAddress(text)) {
                this.recipient = text
            }
        })
    }

    public onTapRemoveContact(index: number) {
        this.settings.contacts.splice(index, 1);
        this.databaseService.saveSettings(this.settings)
            .then(settings => {
                this.databaseService.setSettings(settings);
            })
    }

    public onTapScan() {
        let options: ScanOptions = {
            formats: "QR_CODE"
        }
        this.barcodeScanner.scan(options).then((result) => {
            this.recipient = result.text;
            this.amountField.nativeElement.focus();
        }, (errorMessage) => {
            this.translateService.get('NOTIFICATIONS.ERRORS.QR_CODE').subscribe((res: string) => {
                this.notificationService.info(res);
            });
        });
    }

    public onTapAccept() {

        if (!this.verifyRecipient()) {
            this.translateService.get('NOTIFICATIONS.ADDRESS').subscribe((res: string) => {
                this.notificationService.info(res);
            });
            return;
        }
        if (!this.verifyAmount()) {
            this.translateService.get('NOTIFICATIONS.DECIMAL_AMOUNT').subscribe((res: string) => {
                this.notificationService.info(res);
            });
            return;
        }
        if (!this.verifyFee()) {
            this.translateService.get('NOTIFICATIONS.DECIMAL_FEE').subscribe((res: string) => {
                this.notificationService.info(res);
            });
            return;
        }
        if (!this.verifyTotal()) {
            this.translateService.get('NOTIFICATIONS.EXCEED').subscribe((res: string) => {
                this.notificationService.info(res);
            });
            return;
        }
        if (!this.accountService.checkPin(this.pin)) {
            this.translateService.get('NOTIFICATIONS.WRONG_PIN').subscribe((res: string) => {
                this.notificationService.info(res);
            });
            return;
        }

        // No problem detected with the given information

        // TODO: ask the user again if send or cancel.

        this.sendService.setRecipient(this.recipient);
        this.sendService.setAmount(this.amount);
        this.sendService.setFee(this.fee);
        this.sendService.setMessage(this.message);
        this.sendService.setMessageEncrypted(this.messageEncrypted);

        this.loading = true;
        this.sendService.createTransaction(this.account.keys, this.pin).then(transaction => {
        this.accountService.doTransaction(transaction, this.account.keys.signPrivateKey, this.pin)
                        .then(transaction => {
                            this.translateService.get('NOTIFICATIONS.TRANSACTION').subscribe((res: string) => {
                                this.notificationService.info(res);
                            });
                            this.sendService.reset();
                            this.router.navigate(['/tabs'], { clearHistory: true });
                        }).catch(error => {
                            this.loading = false;
                            this.notificationService.info(error);
                        })
                }).catch(error => {
                    this.loading = false;
                    if (error instanceof UnknownAccountError) {
                        this.translateService.get('NOTIFICATIONS.ERRORS.NO_PUBLIC_KEY').subscribe((res: string) => {
                            this.notificationService.info(res);
                        });
                    }
                })
    }


    public verifyRecipient(): boolean {
        return BurstAddress.isBurstcoinAddress(this.recipient)
    }

    public verifyAmount(): boolean {
        return this.amount != undefined && this.amount >= 0
    }

    public verifyFee() {
        return this.fee != undefined && this.fee >= constants.minimumFee
    }

    public verifyTotal(): boolean {
        return Number(this.amount) + Number(this.fee) <= this.account.balance
    }

    public calculateTotal() {
        if (this.amount < 0) {
            this.amount = undefined;
        }
        if (this.fee < constants.minimumFee) {
            this.fee = constants.minimumFee;
        }
        if (this.amount != undefined && !this.verifyTotal()) {
            this.amount = this.account.balance - Number(this.fee);
            if (this.amount < 0) {
                this.amount = 0;
                this.translateService.get('NOTIFICATIONS.EXCEED').subscribe((res: string) => {
                    this.notificationService.info(res);
                });
            }
        }
        if (this.amount == undefined) {
            this.total = Number(this.fee);
        } else {
            this.total = Number(this.amount) + Number(this.fee);
        }
    }
}
