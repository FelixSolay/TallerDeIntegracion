export interface CustomerAddress {
  calle: string;
  altura: string;
  piso: string;
  departamento: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
}

export function createEmptyAddress(): CustomerAddress {
  return {
    calle: '',
    altura: '',
    piso: '',
    departamento: '',
    ciudad: '',
    provincia: '',
    codigoPostal: ''
  };
}

export function trimAddress(input: Partial<CustomerAddress> | null | undefined): CustomerAddress {
  return {
    calle: typeof input?.calle === 'string' ? input.calle.trim() : '',
    altura: typeof input?.altura === 'string' ? input.altura.trim() : '',
    piso: typeof input?.piso === 'string' ? input.piso.trim() : '',
    departamento: typeof input?.departamento === 'string' ? input.departamento.trim() : '',
    ciudad: typeof input?.ciudad === 'string' ? input.ciudad.trim() : '',
    provincia: typeof input?.provincia === 'string' ? input.provincia.trim() : '',
    codigoPostal: typeof input?.codigoPostal === 'string' ? input.codigoPostal.trim() : ''
  };
}

export function hasAddressData(address: Partial<CustomerAddress> | null | undefined): boolean {
  if (!address) {
    return false;
  }
  return Object.values(address).some((value) => typeof value === 'string' && value.trim() !== '');
}

export function buildFullAddress(address: Partial<CustomerAddress> | null | undefined): string {
  const trimmed = trimAddress(address);
  const segments: string[] = [];

  if (trimmed.calle) {
    const calleLinea = trimmed.altura ? `${trimmed.calle} ${trimmed.altura}` : trimmed.calle;
    segments.push(calleLinea);
  }

  const detalles: string[] = [];
  if (trimmed.piso) {
    detalles.push(`Piso ${trimmed.piso}`);
  }
  if (trimmed.departamento) {
    detalles.push(`Depto ${trimmed.departamento}`);
  }
  if (detalles.length > 0) {
    segments.push(detalles.join(', '));
  }

  const ciudadPartes: string[] = [];
  if (trimmed.ciudad) {
    ciudadPartes.push(trimmed.ciudad);
  }
  if (trimmed.codigoPostal) {
    ciudadPartes.push(`(${trimmed.codigoPostal})`);
  }
  if (ciudadPartes.length > 0) {
    segments.push(ciudadPartes.join(' '));
  }

  if (trimmed.provincia) {
    segments.push(trimmed.provincia);
  }

  return segments.join(', ').trim();
}
