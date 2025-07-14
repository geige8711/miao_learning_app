import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LearningModeComponent } from './learning-mode.component';

describe('LearningModeComponent', () => {
  let component: LearningModeComponent;
  let fixture: ComponentFixture<LearningModeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearningModeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LearningModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
