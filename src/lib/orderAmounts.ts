/** Montant marchandises uniquement (articles, hors livraison). */
export const getMerchandiseAmount = (order: {
  total_amount?: number | null;
}) => Number(order.total_amount || 0);

/** Total payé par le client (articles + livraison). */
export const getCustomerPayableTotal = (order: {
  total_amount?: number | null;
  delivery_fee?: number | null;
}) => getMerchandiseAmount(order) + Number(order.delivery_fee || 0);
