/**
 * CACS-CL — Coronary Artery Calcium Score weighted Clinical Likelihood
 *
 * Implementation fidèle du modèle de régression linéaire publié dans :
 *   Winther S, Schmidt SE, Mayrhofer T, et al.
 *   "Incorporating Coronary Calcification Into Pre-Test Assessment of the
 *   Likelihood of Coronary Artery Disease."
 *   J Am Coll Cardiol. 2020;76(21):2421-2432. (Appendix 1, Table S3)
 *
 * Formule officielle (linéaire, avec interactions) :
 *
 *   CACS_CL =  0.0013
 *            + (RF_CL  * 0.2021)
 *            + (cacs_1_9      * 0.0082)
 *            + (cacs_10_99    * 0.0238)
 *            + (cacs_100_399  * 0.1131)
 *            + (cacs_400_999  * 0.2306)
 *            + (cacs_1000     * 0.4040)
 *            + (RF_CL * cacs_1_9      * 0.1311)
 *            + (RF_CL * cacs_10_99    * 0.2909)
 *            + (RF_CL * cacs_100_399  * 0.4077)
 *            + (RF_CL * cacs_400_999  * 0.4658)
 *            + (RF_CL * cacs_1000     * 0.4489)
 *
 * où RF_CL est la probabilité (0–1) issue du modèle Risk Factor weighted
 * Clinical Likelihood, et les cacs_X sont des variables indicatrices (0/1)
 * pour les classes du score d'Agatston (0, 1–9, 10–99, 100–399, 400–999, ≥1000).
 *
 * AUC du modèle simplifié : 86.8 % (IC 95 % : 85.9 – 87.6).
 */

/** Catégories CACS d'Agatston utilisées dans le modèle. */
export type CACSBin = "0" | "1-9" | "10-99" | "100-399" | "400-999" | ">=1000"

/** Coefficients principaux (β) — effet propre de la classe CACS. */
const BETA: Record<Exclude<CACSBin, "0">, number> = {
  "1-9": 0.0082,
  "10-99": 0.0238,
  "100-399": 0.1131,
  "400-999": 0.2306,
  ">=1000": 0.4040,
}

/** Coefficients d'interaction (γ) — RF_CL × classe CACS. */
const GAMMA: Record<Exclude<CACSBin, "0">, number> = {
  "1-9": 0.1311,
  "10-99": 0.2909,
  "100-399": 0.4077,
  "400-999": 0.4658,
  ">=1000": 0.4489,
}

/** Constante du modèle (intercept). */
const INTERCEPT = 0.0013

/** Coefficient principal pour RF_CL (effet propre, classe CACS = 0 en référence). */
const RF_CL_COEF = 0.2021

/**
 * Convertit un score d'Agatston numérique vers la catégorie utilisée dans le
 * modèle. Les bornes sont celles du papier original (Table S3, note 7).
 */
export function getCACSBin(cacScore: number): CACSBin {
  if (!Number.isFinite(cacScore) || cacScore <= 0) return "0"
  if (cacScore < 10) return "1-9"
  if (cacScore < 100) return "10-99"
  if (cacScore < 400) return "100-399"
  if (cacScore < 1000) return "400-999"
  return ">=1000"
}

/**
 * Calcule la probabilité CACS-CL (en pourcentage) à partir de la probabilité
 * RF-CL (en pourcentage) et de la catégorie d'Agatston.
 *
 * @param rfclPercent - RF-CL en pourcentage (0–100)
 * @param bin         - Classe CACS d'Agatston
 * @returns CACS-CL en pourcentage, borné à [0, 100]
 */
export function computeCACSCLFromBin(rfclPercent: number, bin: CACSBin): number {
  const rfProb = clamp(rfclPercent, 0, 100) / 100

  // Variables indicatrices (one-hot, "0" est la classe de référence).
  const d_1_9 = bin === "1-9" ? 1 : 0
  const d_10_99 = bin === "10-99" ? 1 : 0
  const d_100_399 = bin === "100-399" ? 1 : 0
  const d_400_999 = bin === "400-999" ? 1 : 0
  const d_1000 = bin === ">=1000" ? 1 : 0

  const linear =
    INTERCEPT +
    rfProb * RF_CL_COEF +
    d_1_9 * BETA["1-9"] +
    d_10_99 * BETA["10-99"] +
    d_100_399 * BETA["100-399"] +
    d_400_999 * BETA["400-999"] +
    d_1000 * BETA[">=1000"] +
    rfProb * d_1_9 * GAMMA["1-9"] +
    rfProb * d_10_99 * GAMMA["10-99"] +
    rfProb * d_100_399 * GAMMA["100-399"] +
    rfProb * d_400_999 * GAMMA["400-999"] +
    rfProb * d_1000 * GAMMA[">=1000"]

  // Le modèle est une régression linéaire : on borne le résultat à [0, 100 %].
  return clamp(linear * 100, 0, 100)
}

/**
 * Variante acceptant un score d'Agatston numérique. Convertit automatiquement
 * vers la catégorie correspondante avant d'appliquer la formule.
 */
export function computeCACSCL(rfclPercent: number, cacScore: number): number {
  return computeCACSCLFromBin(rfclPercent, getCACSBin(cacScore))
}

/** Libellé lisible de la catégorie CACS (FR). */
export function getCACSBinLabel(bin: CACSBin): string {
  switch (bin) {
    case "0":
      return "CACS = 0"
    case "1-9":
      return "CACS 1–9"
    case "10-99":
      return "CACS 10–99"
    case "100-399":
      return "CACS 100–399"
    case "400-999":
      return "CACS 400–999"
    case ">=1000":
      return "CACS ≥ 1000"
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
