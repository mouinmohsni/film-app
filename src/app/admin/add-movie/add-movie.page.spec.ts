import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddMoviePage } from './add-movie.page';

describe('AddMoviePage', () => {
  let component: AddMoviePage;
  let fixture: ComponentFixture<AddMoviePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddMoviePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
