import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReviewModeComponent } from './review-mode.component';

describe('ReviewModeComponent', () => {
  let component: ReviewModeComponent;
  let fixture: ComponentFixture<ReviewModeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewModeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReviewModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
