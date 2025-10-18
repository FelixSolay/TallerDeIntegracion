import { TestBed } from '@angular/core/testing';

import { PulseraService } from './pulsera.service';

describe('PulseraService', () => {
  let service: PulseraService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PulseraService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
