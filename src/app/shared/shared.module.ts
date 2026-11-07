import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';

import { PageHeaderComponent } from './page-header/page-header.component';

@NgModule({
  declarations: [PageHeaderComponent],
  imports: [CommonModule, IonicModule],
  exports: [PageHeaderComponent],
})
export class SharedModule {}
