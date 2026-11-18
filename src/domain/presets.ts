import type { BuildSelection } from '../types/components';

/** Starter builds. All are fully compatible (checked in compatibility.test.ts). */
export const PRESET_BUILDS: Record<string, { name: string; selection: BuildSelection }> = {
  colnagoV5rsUae: {
    name: 'Colnago V5Rs · Team UAE',
    selection: {
      frame: 'frame-colnago-v5rs',
      wheels: 'wheels-enve-ses-45',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-colnago-cc01',
      saddle: 'sd-fizik-argo-vento',
      tyres: 'ty-pirelli-pzero-race-30',
    },
  },
  colnagoY1rsUae: {
    name: 'Colnago Y1Rs · Team UAE',
    selection: {
      frame: 'frame-colnago-y1rs',
      wheels: 'wheels-enve-ses-45',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-colnago-ccy1',
      saddle: 'sd-fizik-argo-vento',
      tyres: 'ty-vittoria-corsa-pro-28',
    },
  },
  canyonAeroad: {
    name: 'Canyon Aeroad · SRAM Red',
    selection: {
      frame: 'frame-canyon-aeroad',
      wheels: 'wheels-dt-arc-1100-80',
      groupset: 'gs-sram-red-axs',
      rearDerailleur: 'rd-sram-red-axs',
      handlebars: 'hb-canyon-cp0018',
      saddle: 'sd-selle-italia-slr',
      tyres: 'ty-conti-gp5000str-28',
    },
  },
  pinarelloDogma: {
    name: 'Pinarello Dogma F · Dura-Ace',
    selection: {
      frame: 'frame-pinarello-dogma-f',
      wheels: 'wheels-shimano-da-c50',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-pinarello-talon',
      saddle: 'sd-fizik-antares-r1',
      tyres: 'ty-conti-gp5000str-28',
    },
  },
  trekMadone: {
    name: 'Trek Madone · SRAM Force',
    selection: {
      frame: 'frame-trek-madone-slr',
      wheels: 'wheels-zipp-404-firecrest',
      groupset: 'gs-sram-force-axs',
      rearDerailleur: 'rd-sram-force-axs',
      handlebars: 'hb-trek-rsl-aero',
      saddle: 'sd-specialized-power-comp',
      tyres: 'ty-pirelli-pzero-race-30',
    },
  },
  allRoundRace: {
    name: 'S-Works Tarmac · 105',
    selection: {
      frame: 'frame-sworks-tarmac-sl8',
      wheels: 'wheels-zipp-303-firecrest',
      groupset: 'gs-shimano-105-r7100',
      rearDerailleur: 'rd-shimano-105-r7100',
      handlebars: 'hb-zipp-sc70',
      saddle: 'sd-specialized-power-comp',
      tyres: 'ty-conti-gp5000str-28',
    },
  },
  colnagoUltegra: {
    name: 'Colnago V4Rs · Ultegra Di2',
    selection: {
      frame: 'frame-colnago-v4rs',
      wheels: 'wheels-enve-ses-45',
      groupset: 'gs-shimano-ultegra-di2',
      rearDerailleur: 'rd-shimano-ultegra-r8150',
      handlebars: 'hb-colnago-cc01',
      saddle: 'sd-fizik-argo-vento',
      tyres: 'ty-vittoria-corsa-pro-28',
    },
  },
  sworksDuraAce: {
    name: 'S-Works Tarmac · Dura-Ace Di2',
    selection: {
      frame: 'frame-sworks-tarmac-sl8',
      wheels: 'wheels-roval-rapide',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-roval-rapide-cockpit',
      saddle: 'sd-sworks-power-mirror',
      tyres: 'ty-conti-gp5000str-28',
    },
  },
  budgetAlloy: {
    name: 'Java Siluro · Sora',
    selection: {
      frame: 'frame-java-siluro',
      wheels: 'wheels-shimano-r501',
      groupset: 'gs-shimano-sora',
      rearDerailleur: 'rd-shimano-sora',
      handlebars: 'hb-fsa-omega-compact',
      saddle: 'sd-wtb-volt',
      tyres: 'ty-conti-ultrasport-25',
    },
  },
  sunpeedTiagra: {
    name: 'Sunpeed Zero · Tiagra',
    selection: {
      frame: 'frame-sunpeed-zero',
      wheels: 'wheels-fulcrum-racing-zero',
      groupset: 'gs-shimano-tiagra',
      rearDerailleur: 'rd-shimano-tiagra',
      handlebars: 'hb-zipp-sc70',
      saddle: 'sd-prologo-dimension',
      tyres: 'ty-conti-gp5000-28',
    },
  },
  rimClimber: {
    name: 'Colnago C64 · Ultegra (rim)',
    selection: {
      frame: 'frame-colnago-c64-rim',
      wheels: 'wheels-fulcrum-racing-zero',
      groupset: 'gs-shimano-ultegra-r8000-rim',
      rearDerailleur: 'rd-shimano-ultegra-r8000-ss',
      handlebars: 'hb-zipp-sl70-aero',
      saddle: 'sd-fizik-antares-r1',
      tyres: 'ty-specialized-turbo-cotton-26',
    },
  },
  timeTrial: {
    name: 'Canyon Speedmax · Dura-Ace',
    selection: {
      frame: 'frame-canyon-speedmax',
      wheels: 'wheels-zipp-super9-858',
      groupset: 'gs-shimano-da-di2',
      rearDerailleur: 'rd-shimano-da-r9250',
      handlebars: 'hb-vision-metron-tfe',
      saddle: 'sd-ism-pn31',
      tyres: 'ty-conti-gp5000tt-25',
    },
  },
  gravel: {
    name: 'Kross Esker · GRX',
    selection: {
      frame: 'frame-kross-esker',
      wheels: 'wheels-dt-g1800',
      groupset: 'gs-shimano-grx-rx820',
      rearDerailleur: 'rd-shimano-grx-rx820',
      handlebars: 'hb-zipp-sc70-xplr',
      saddle: 'sd-wtb-volt',
      tyres: 'ty-panaracer-gravelking-38',
    },
  },
};

export const DEFAULT_PRESET = 'colnagoV5rsUae';
