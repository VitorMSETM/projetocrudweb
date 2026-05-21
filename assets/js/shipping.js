export const freteTabela = {
  SP:12, RJ:14, MG:16, ES:15,
  PR:15, SC:16, RS:17,
  DF:16, GO:17, MT:18, MS:18,
  BA:18, PE:17, CE:15,
  RN:16, PB:17, PI:18,
  SE:17, AL:17, MA:19,
  PA:20, AM:22, RR:24,
  AP:23, TO:20, RO:21, AC:24
};

export function calcularFrete(estado) {
  return freteTabela[estado] || (estado ? 22 : 0);
}