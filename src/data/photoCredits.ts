// 참고 사진 출처(Wikimedia Commons). 실제 해당 현장의 사진이 아니라 유형을 보여 주는 참고 이미지다.
export interface PhotoCredit { file: string; title: string; author: string; license: string; source: string }

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  "sand-1": {
    "file": "/photos/sand-1.jpg",
    "title": "Pile of fine sand at Brastad Arena 2.jpg",
    "author": "W.carter",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pile_of_fine_sand_at_Brastad_Arena_2.jpg"
  },
  "nourish-1": {
    "file": "/photos/nourish-1.jpg",
    "title": "Beach nourishment in Bat Yam.jpg",
    "author": "בר",
    "license": "CC BY-SA 3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Beach_nourishment_in_Bat_Yam.jpg"
  },
  "nourish-2": {
    "file": "/photos/nourish-2.jpg",
    "title": "Buxton beach nourishment in progress, July 2022.jpg",
    "author": "Cape Hatteras National Seashore, National Park Service",
    "license": "Public domain",
    "source": "https://commons.wikimedia.org/wiki/File:Buxton_beach_nourishment_in_progress,_July_2022.jpg"
  },
  "dredger-1": {
    "file": "/photos/dredger-1.jpg",
    "title": "Dredge Ship Liberty Island transports dredged sand closer to shore for the pump-out.jpg",
    "author": "BOEM-OPA",
    "license": "CC BY-SA 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Dredge_Ship_Liberty_Island_transports_dredged_sand_closer_to_shore_for_the_pump-out.jpg"
  },
  "dredger-2": {
    "file": "/photos/dredger-2.jpg",
    "title": "Sand Dredge @ Waikiki (7002300211).jpg",
    "author": "Daniel Ramirez from Honolulu, USA",
    "license": "CC BY 2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sand_Dredge_@_Waikiki_(7002300211).jpg"
  },
  "dredged-1": {
    "file": "/photos/dredged-1.jpg",
    "title": "Uitbaggeren Langweerderwielen. (actm) 02.jpg",
    "author": "Agnes Monkelbaan",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Uitbaggeren_Langweerderwielen._(actm)_02.jpg"
  },
  "dredged-2": {
    "file": "/photos/dredged-2.jpg",
    "title": "Uitbaggeren Langweerderwielen. (actm) 09.jpg",
    "author": "Agnes Monkelbaan",
    "license": "CC BY-SA 4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Uitbaggeren_Langweerderwielen._(actm)_09.jpg"
  },
  "tidal-1": {
    "file": "/photos/tidal-1.jpg",
    "title": "Gochang tidal flat 01.jpg",
    "author": "문화재청",
    "license": "KOGL Type 1",
    "source": "https://commons.wikimedia.org/wiki/File:Gochang_tidal_flat_01.jpg"
  },
  "tidal-2": {
    "file": "/photos/tidal-2.jpg",
    "title": "Gochang tidal flat 02.jpg",
    "author": "문화재청",
    "license": "KOGL Type 1",
    "source": "https://commons.wikimedia.org/wiki/File:Gochang_tidal_flat_02.jpg"
  }
};
