import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { VortexBlotter } from './vortex-blotter';

vi.mock('@perspective-dev/client', () => ({
  default: {
    worker: vi.fn().mockResolvedValue({
      table: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock('@perspective-dev/viewer-datagrid', () => ({}));
vi.mock('@perspective-dev/viewer-d3fc', () => ({}));

describe('VortexBlotter', () => {
  let component: VortexBlotter;
  let fixture: ComponentFixture<VortexBlotter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VortexBlotter],
    }).compileComponents();

    fixture = TestBed.createComponent(VortexBlotter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
