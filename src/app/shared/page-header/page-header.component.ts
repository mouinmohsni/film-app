import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  standalone: false,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() showMenu = false;
  @Input() showBack = false;
  @Input() defaultHref = '/home';
}
