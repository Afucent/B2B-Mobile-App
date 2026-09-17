export type DealerLocationFields = {
  dealer_address?: string | null;
  dealer_area?: string | null;
  dealer_city?: string | null;
  dealer_state?: string | null;
  dealer_country?: string | null;
  dealer_pin_code?: string | null;
};

export function dealerLocationLines(fields: DealerLocationFields): string[] {
  const lines: string[] = [];
  const address = fields.dealer_address?.trim();
  const area = fields.dealer_area?.trim();
  const city = fields.dealer_city?.trim();
  const state = fields.dealer_state?.trim();
  const country = fields.dealer_country?.trim();
  const pin = fields.dealer_pin_code?.trim();

  if (address) lines.push(address);

  const locality = [area, city, state].filter(Boolean).join(', ');
  if (locality) lines.push(locality);

  if (pin) lines.push(`PIN ${pin}`);
  if (country && !locality.toLowerCase().includes(country.toLowerCase())) {
    lines.push(country);
  }

  return lines;
}

export function formatDealerLocation(fields: DealerLocationFields, fallback = 'No address on file') {
  const lines = dealerLocationLines(fields);
  return lines.length ? lines.join('\n') : fallback;
}
