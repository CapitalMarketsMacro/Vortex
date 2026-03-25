import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';

vi.mock('@perspective-dev/client', () => ({
  default: {
    worker: vi.fn().mockResolvedValue({
      table: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock('@perspective-dev/viewer-datagrid', () => ({}));
vi.mock('@perspective-dev/viewer-d3fc', () => ({}));

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Vortex');
  });
});
