/**
 * Marque Cardiomaine — « Le C battant ».
 *
 * Un C ouvert (l'initiale) dont l'ouverture laisse sortir la pulsation. Deux
 * masses franches, aucun détail fin : la marque tient jusqu'à 16 px, ce qui est
 * la contrainte réelle (favicon d'onglet, tuile d'écran d'accueil iOS).
 *
 * Géométrie canonique, à ne pas redessiner ailleurs :
 *   - arc de 260°, rayon 21, filet 8,5, ouverture de 100° centrée sur l'axe
 *     horizontal ;
 *   - la pointe R du complexe culmine exactement dans la bouche du C.
 *
 * Les couleurs passent par des props et non par le CSS ambiant : la marque doit
 * pouvoir être rasterisée telle quelle (voir scripts/build-brand-icons.mjs).
 */

/** Boîte canonique, avec la marge d'air du logo. */
export const MARK_VIEWBOX = "0 0 64 64"
/** Boîte serrée sur le dessin : à utiliser quand le conteneur fournit déjà la marge. */
export const MARK_VIEWBOX_TIGHT = "6.7 5.8 52.4 52.4"

export const MARK_INK = "#0F2A47"
export const MARK_PULSE = "#B23A48"
/** Variantes en réserve, calibrées pour rester lisibles sur le panneau #0F2A47. */
export const MARK_INK_REVERSED = "#FFFFFF"
export const MARK_PULSE_REVERSED = "#EE8894"

type CardiomaineMarkProps = {
  /** Côté du carré, en pixels. Omis, la marque remplit son conteneur. */
  size?: number
  /** Couleur du C. */
  ink?: string
  /** Couleur de la pulsation. */
  pulse?: string
  /** Serre le cadrage sur le dessin, sans marge d'air. */
  tight?: boolean
  className?: string
  /**
   * Texte alternatif. Vide (défaut), la marque est décorative : c'est le cas
   * dès qu'un « Cardiomaine » en texte l'accompagne, pour ne pas faire répéter
   * le nom deux fois au lecteur d'écran.
   */
  title?: string
}

export function CardiomaineMark({
  size,
  ink = MARK_INK,
  pulse = MARK_PULSE,
  tight = false,
  className,
  title,
}: CardiomaineMarkProps) {
  return (
    <svg
      viewBox={tight ? MARK_VIEWBOX_TIGHT : MARK_VIEWBOX}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path
        d="M45.5 15.9A21 21 0 1 0 45.5 48.1"
        fill="none"
        stroke={ink}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M16.5 32H32l5-11.5 6 23 4-11.5h9"
        fill="none"
        stroke={pulse}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type CardiomaineLockupProps = {
  /** Inscription sous le nom. `null` pour n'afficher que le nom. */
  subtitle?: string | null
  /** Rend la marque et le texte en réserve, pour un fond sombre. */
  reversed?: boolean
  /** Côté de la marque, en pixels. */
  markSize?: number
  className?: string
}

/**
 * Lockup horizontal : marque + nom + inscription de service. Le nom est en
 * texte et non en tracé, pour rester sélectionnable et suivre la police de
 * l'interface.
 */
export function CardiomaineLockup({
  subtitle = "Planning médical",
  reversed = false,
  markSize = 34,
  className,
}: CardiomaineLockupProps) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.625rem" }}>
      <CardiomaineMark
        size={markSize}
        tight
        ink={reversed ? MARK_INK_REVERSED : MARK_INK}
        pulse={reversed ? MARK_PULSE_REVERSED : MARK_PULSE}
      />
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: "1.0625rem",
            fontWeight: 600,
            letterSpacing: "-0.022em",
            lineHeight: 1,
            color: reversed ? "#FFFFFF" : MARK_INK,
          }}
        >
          Cardiomaine
        </span>
        {subtitle ? (
          <span
            style={{
              marginTop: "0.3rem",
              fontSize: "0.5625rem",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              lineHeight: 1,
              color: reversed ? "#8FA8C0" : "#61758A",
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  )
}
