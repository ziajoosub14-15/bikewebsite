/**
 * Component data model. Every part in src/data/components/*.json follows these types.
 * To add a part: copy an existing entry in the matching JSON file, give it a unique id,
 * and adjust the numbers. The data tests (src/data/components.test.ts) check that it is valid.
 */

export type Category =
  | 'frame'
  | 'wheels'
  | 'rearDerailleur'
  | 'groupset'
  | 'handlebars'
  | 'saddle'
  | 'tyres';

export const CATEGORIES: Category[] = [
  'frame',
  'wheels',
  'groupset',
  'rearDerailleur',
  'handlebars',
  'saddle',
  'tyres',
];

export type BrakeType = 'rim' | 'disc';
/** QR = quick release (older rim-brake standard); thru-12 = 12 mm thru-axle (modern disc standard). */
export type AxleStandard = 'qr' | 'thru-12';
/** Groupset brands. Parts from different brands do not shift together. */
export type GroupsetBrand = 'Shimano' | 'SRAM' | 'Campagnolo';
export type GearCount = 9 | 10 | 11 | 12 | 13;

/** Compatibility tags. A field left out means "works with anything" for that rule. */
export interface CompatibilityTags {
  brakeType?: BrakeType;
  axle?: AxleStandard;
  brand?: GroupsetBrand;
  speeds?: GearCount;
}

/** Fields every component has. */
export interface BaseComponent {
  id: string;
  /** Manufacturer, e.g. "Colnago", "Shimano". Used for brand filters in the builder. */
  brand: string;
  /** Model name without the brand, e.g. "V4Rs". */
  name: string;
  category: Category;
  /** Price in AED. */
  price: number;
  /** Weight in grams. */
  weight: number;
  /**
   * Change in total drag area (CdA, m²) compared with a basic reference part.
   * Negative = more aerodynamic. Typical range −0.02 to +0.01.
   */
  cdaDelta: number;
  /** 1 (harsh) to 10 (plush). */
  comfort: number;
  /** 1 (flexy) to 10 (very stiff, efficient). */
  stiffness: number;
  compat: CompatibilityTags;
  description: string;
}

export type FrameType = 'aero' | 'climbing' | 'endurance' | 'gravel' | 'tt';
/** Geometry family; used by the fit calculator to look up stack/reach per size. */
export type GeometryFamily = 'race' | 'endurance' | 'gravel' | 'tt';

export type Finish = 'gloss' | 'matte' | 'pearl' | 'metallic';

/**
 * How a frame is painted. Zones:
 *  solid      – every tube in `base`
 *  headBlock  – head tube, fork and the front of the top and down tubes in `accent` (blocky team look)
 *  rear       – chain and seat stays in `accent`
 *  topTube    – top tube in `accent` (often a different finish, e.g. gloss on matte)
 *  front      – front triangle in `base`, fork + rear in `accent`
 *  fade       – colour fades from `base` (rear) to `accent` (front)
 * `stripes` adds bands (e.g. world champion rainbow) on the top tube, seat tube and fork.
 */
export interface Colourway {
  id: string;
  name: string;
  base: string;
  accent?: string;
  pattern: 'solid' | 'headBlock' | 'rear' | 'topTube' | 'front' | 'fade';
  finish: Finish;
  accentFinish?: Finish;
  /** Logo colour. */
  decal: string;
  /** Second logo colour, used for small details. */
  detail?: string;
  stripes?: string[];
  /** true = colour names/layout confirmed from the maker or dealer listings; false = a typical colourway, approximate. */
  official: boolean;
}

/** Side-view shape of a frame model. Lengths in drawing units (0.5 per mm); depths are multiples of the base tube size. */
export interface FrameShapeData {
  /** How far the seat tube bows forward around the rear wheel. */
  stCurve: number;
  /** Where the top tube meets the seat tube (0 = BB, 1 = top of seat tube). Lower = more sloping. */
  ttJoin: number;
  /** Upward (+) or downward (−) bow of the top tube. */
  ttBend: number;
  /** Downward bow of the down tube. */
  dtBend: number;
  /** Where the seat stays meet the seat tube (0–1). Low = "dropped" stays. */
  stayJoin: number;
  stays: 'straight' | 'wavy' | 'bowed';
  depth: {
    dt: [number, number];
    tt: [number, number];
    st: [number, number];
    ht: number;
    cs: [number, number];
    ss: [number, number];
    fork: number;
  };
  /** Length of an aero nose cone in front of the head tube (e.g. Specialized "Speed Sniffer"). */
  nose: number;
  /** Extra head tube height above the top tube. */
  headUp: number;
  fork: 'straight' | 'curved' | 'wavy' | 'bayonet';
  /** Visible lug joints (Colnago C68 / C64). */
  lugs: boolean;
  /** Trek IsoFlow: an opening through the seat mast. */
  isoFlow: boolean;
  /** Specialized Future Shock: a sprung boot above the head tube. */
  futureShock: boolean;
  /** Storage box on the top tube (TT/triathlon). */
  bento: boolean;
  /** Integrated seat mast with a topper instead of a round seatpost. */
  seatMast: boolean;
  /** Seatpost leaves the frame at its own angle, forming a Y junction (Colnago Y1Rs). */
  offAxisPost: boolean;
}

export interface Frame extends BaseComponent {
  category: 'frame';
  colourways: Colourway[];
  /** Where the model sits in its brand's line-up. */
  range: 'top' | 'mid' | 'entry';
  /** Frame material: changes how it looks (carbon weave, alloy welds). */
  material: 'carbon' | 'alloy' | 'steel';
  /** How this model's frame is shaped (overrides the defaults for its frame type). See ui/bike/frameShape.ts. */
  shape?: Partial<FrameShapeData>;
  /** Proprietary cockpits: the frame only works with these handlebar ids. */
  requiresBars?: string[];
  frameType: FrameType;
  geometry: GeometryFamily;
  /** Widest tyre (mm) the frame fits with safe clearance. */
  maxTyreWidthMm: number;
  /** Internal cable routing is needed for fully integrated aero cockpits. */
  internalRouting: boolean;
  /** Frame sizes offered, by seat tube length in cm. */
  sizesCm: number[];
}

export type WheelProfile = 'shallow' | 'mid' | 'deep' | 'disc';

export interface WheelLook {
  rim: 'carbon-matte' | 'carbon-gloss' | 'alloy-black' | 'alloy-silver';
  /** Text printed on the rim (usually the brand or model). */
  decalText: string;
  /** Smaller model name printed after the logo (e.g. "SES 4.5"). */
  decalSub?: string;
  decalColor: string;
  /** Bold = big, high-contrast logos; subtle = small or tonal logos. */
  decalStyle: 'bold' | 'subtle';
  /** Spoke colour (a few wheels have coloured spokes). */
  spokes?: string;
  /** Rim depth front / rear (mm) when they differ (e.g. ENVE SES 4.5: 50 / 56). */
  depthFront?: number;
  depthRear?: number;
  spokesFront?: number;
  spokesRear?: number;
  /** Rear lacing pattern: two-cross, Campagnolo G3 (spokes in threes) or Fulcrum 2:1. Fronts are radial. */
  lacing?: '2x' | 'g3' | '2to1';
  /** Zipp NSW "Sawtooth" rims have a wavy inner edge. */
  wavyRim?: boolean;
}

export interface Wheels extends BaseComponent {
  category: 'wheels';
  look: WheelLook;
  profile: WheelProfile;
  rimDepthMm: number;
  /** Internal rim width (mm). Tyres should be roughly 1.4–2.5× this. */
  internalWidthMm: number;
  /** Tubular rims only accept tubular tyres; hookless-free clincher rims take clincher/tubeless. */
  rimType: 'clincher' | 'tubular';
  /**
   * 0 (unaffected) to 1 (very affected). How much a crosswind upsets handling,
   * which forces the rider out of their most aero position.
   */
  crosswindSensitivity: number;
}

export interface Groupset extends BaseComponent {
  category: 'groupset';
  /** Shifters, brakes, chainset, cassette and chain. The rear derailleur is chosen separately. */
  tier: 'entry' | 'mid' | 'performance' | 'pro';
  /** Fraction of pedal power that reaches the rear wheel (0.96–0.98). */
  drivetrainEfficiency: number;
  /** Chainring teeth: one ring (1x) or two (2x). */
  chainrings: number[];
  /** Smallest and largest cassette cog. */
  cassette: [number, number];
  electronic: boolean;
}

export interface RearDerailleur extends BaseComponent {
  category: 'rearDerailleur';
  /** Largest cassette cog (teeth) it can wrap. */
  maxCog: number;
  electronic: boolean;
}

export type HandlebarType = 'standard' | 'aero-integrated' | 'flared-gravel' | 'tri-aero';
export type RidingPosition = 'hoods' | 'drops' | 'aero';

export interface Handlebars extends BaseComponent {
  category: 'handlebars';
  barType: HandlebarType;
  /** Positions the rider can actually adopt with these bars. */
  positions: RidingPosition[];
  /** Integrated stem length (mm) where fixed; null when a separate stem is used. */
  integratedStemMm: number | null;
  /**
   * Drawing style for brand cockpits: 'v-stem' (Cervélo), 'y-cockpit' (Colnago CC.Y1, fixed into the
   * head tube), 'wing-kink' (Canyon Aerocockpit), 'rise' (Pinarello Talon). Omit for the usual shapes.
   */
  style?: 'v-stem' | 'y-cockpit' | 'wing-kink' | 'rise';
  /** Proprietary cockpit: only fits these frame ids. */
  fitsFrames?: string[];
}

export interface Saddle extends BaseComponent {
  category: 'saddle';
  widthMm: number;
  padding: 'minimal' | 'medium' | 'plush';
  cutout: boolean;
}

export type TyreConstruction = 'clincher' | 'tubeless' | 'tubular';

export interface Tyres extends BaseComponent {
  category: 'tyres';
  widthMm: number;
  construction: TyreConstruction;
  /** Rolling resistance coefficient on smooth tarmac at recommended pressure. */
  crr: number;
  /** Manufacturer-style recommended pressure for a ~75 kg rider (bar). */
  recommendedPressureBar: number;
  /** Dry grip coefficient on tarmac (0.7–1.0). */
  grip: number;
  tread: 'slick' | 'file' | 'knob';
  /** Sidewall colour: many premium tyres come with tan (skinwall) sides. */
  sidewall: 'black' | 'tan';
}

export type BikeComponent =
  | Frame
  | Wheels
  | Groupset
  | RearDerailleur
  | Handlebars
  | Saddle
  | Tyres;

export interface ComponentByCategory {
  frame: Frame;
  wheels: Wheels;
  groupset: Groupset;
  rearDerailleur: RearDerailleur;
  handlebars: Handlebars;
  saddle: Saddle;
  tyres: Tyres;
}

/** A build stores one component id per category. */
export type BuildSelection = { [K in Category]: string };
