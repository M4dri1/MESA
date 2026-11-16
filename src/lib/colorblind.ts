/**
 * Modos para quem tem daltonismo. Em vez de só "simular" a visão, o Mesa corrige a tela:
 * descobre o que a pessoa não consegue separar (a diferença entre a cor original e a cor
 * como ela enxerga) e empurra essa diferença para canais de cor que ela distingue bem.
 * O resultado vira um filtro SVG (feColorMatrix) aplicado na página inteira.
 */
export type ColorBlind = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type ColorBlindMode = Exclude<ColorBlind, 'none'>;

type Matrix = number[][];

// Como cada tipo de daltonismo enxerga (Machado, Oliveira e Fernandes, 2009; gravidade 1), em RGB linear
const SIMULATION: Record<ColorBlindMode, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

// Para onde empurrar o que a pessoa não vê: vermelho/verde vira brilho e azul; azul/amarelo vira vermelho e verde
const SHIFT: Record<ColorBlindMode, Matrix> = {
  protanopia: [
    [0, 0, 0],
    [1, 1, 0],
    [1, 0, 1],
  ],
  deuteranopia: [
    [0, 0, 0],
    [1, 1, 0],
    [1, 0, 1],
  ],
  tritanopia: [
    [1, 0, 1],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const multiply = (a: Matrix, b: Matrix): Matrix => a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
const IDENTITY: Matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const subtract = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((value, j) => value - b[i][j]));
const add = (a: Matrix, b: Matrix): Matrix => a.map((row, i) => row.map((value, j) => value + b[i][j]));

/** Matriz 3x3 da correção: cor nova = cor + deslocamento · (cor − cor como a pessoa enxerga) */
export function correctionMatrix(mode: ColorBlindMode): Matrix {
  const error = subtract(IDENTITY, SIMULATION[mode]);
  return add(IDENTITY, multiply(SHIFT[mode], error));
}

/** Valores do feColorMatrix (4 linhas x 5 colunas) para o filtro SVG */
export function feColorMatrixValues(mode: ColorBlindMode): string {
  const m = correctionMatrix(mode);
  const rows = m.map((row) => `${row.map((v) => v.toFixed(5)).join(' ')} 0 0`);
  rows.push('0 0 0 1 0');
  return rows.join(' ');
}

/** Só para teste: como uma cor (0 a 255) é enxergada por quem tem esse tipo de daltonismo */
export function simulateColor(mode: ColorBlindMode, rgb: [number, number, number]): [number, number, number] {
  const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const toSrgb = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  };
  const lin = rgb.map(toLinear);
  const m = SIMULATION[mode];
  return m.map((row) => toSrgb(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])) as [number, number, number];
}

/** Só para teste: a cor depois da correção do Mesa */
export function correctColor(mode: ColorBlindMode, rgb: [number, number, number]): [number, number, number] {
  const toLinear = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const toSrgb = (c: number) => {
    const v = Math.max(0, Math.min(1, c));
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  };
  const lin = rgb.map(toLinear);
  const m = correctionMatrix(mode);
  return m.map((row) => toSrgb(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])) as [number, number, number];
}
