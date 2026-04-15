
export const getSafeCurrency = (currency?: string): string => {
  if (!currency) return 'BRL';
  const match = currency.match(/^[A-Z]{3}/);
  return match ? match[0] : 'BRL';
};

export const formatCurrency = (value: number, currency: string) => {
  return value.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: getSafeCurrency(currency) 
  });
};
