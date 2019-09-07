/*
* Copyright 2018 PoC-Consortium
*/

import { NgModule, NO_ERRORS_SCHEMA } from "@angular/core";
import { NativeScriptCommonModule } from "nativescript-angular/common";
import { NativeScriptFormsModule } from "nativescript-angular/forms";
import { MaskedTextFieldModule } from "nativescript-masked-text-field/angular";
import { SharedModule } from "../../lib/shared.module";

import { ImportRoutingModule } from "./import.routing";
import { ImportComponent } from "./import.component";

import { ShowComponent } from "./show/show.component";

@NgModule({
    imports: [
        NativeScriptCommonModule,
        MaskedTextFieldModule,
        NativeScriptFormsModule,
        SharedModule,
        ImportRoutingModule
    ],
    declarations: [
        ImportComponent,
        ShowComponent
    ],
    providers: [

    ],
    schemas: [
        NO_ERRORS_SCHEMA
    ],
    entryComponents: [ ShowComponent ]
})
export class ImportModule { }
