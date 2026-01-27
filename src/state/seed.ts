export const seedAthletes = [
  {
    "id": "a1",
    "firstName": "Josh",
    "lastName": "Binks",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a2",
    "firstName": "India",
    "lastName": "Binks",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a3",
    "firstName": "Ruby",
    "lastName": "McPhillips",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a4",
    "firstName": "Fin",
    "lastName": "McPhillips",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a5",
    "firstName": "Cate",
    "lastName": "Giason",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a6",
    "firstName": "Russell",
    "lastName": "Taylor",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a7",
    "firstName": "Gary",
    "lastName": "Baker",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a8",
    "firstName": "Amelia",
    "lastName": "Harkness",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a9",
    "firstName": "Kayden",
    "lastName": "Elliot",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a10",
    "firstName": "Macleay",
    "lastName": "Kesby",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a11",
    "firstName": "Jasmine",
    "lastName": "Matthews",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a12",
    "firstName": "Peter",
    "lastName": "Maskiell",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a13",
    "firstName": "Emily",
    "lastName": "McLaren",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a14",
    "firstName": "Hamish",
    "lastName": "McLaren",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a15",
    "firstName": "Sky",
    "lastName": "Bell",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a16",
    "firstName": "Alexis",
    "lastName": "Bell",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a17",
    "firstName": "Poppy",
    "lastName": "Taylor",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a18",
    "firstName": "Ryan",
    "lastName": "Martin",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a19",
    "firstName": "Elias",
    "lastName": "Niyonkuru",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a20",
    "firstName": "Pat",
    "lastName": "Carolan",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a21",
    "firstName": "Will",
    "lastName": "Mason",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a22",
    "firstName": "Harry",
    "lastName": "Fraser",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a23",
    "firstName": "Moses",
    "lastName": "Fowler",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a24",
    "firstName": "Jed",
    "lastName": "Fowler",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a25",
    "firstName": "Tom",
    "lastName": "March",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a26",
    "firstName": "Luke",
    "lastName": "Jones",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a27",
    "firstName": "Ally",
    "lastName": "Rogers",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a28",
    "firstName": "Ash",
    "lastName": "Gard",
    "defaultGroupId": "B",
    "active": true
  },
  {
    "id": "a29",
    "firstName": "Bianca",
    "lastName": "De Swardt",
    "defaultGroupId": "A",
    "active": true
  },
  {
    "id": "a30",
    "firstName": "Alex",
    "lastName": "Torta",
    "defaultGroupId": "B",
    "active": true
  }
] as const;
export const seedTemplates = [
  {
    "id": "t1",
    "name": "8\u00d7800 on 5:00 + 4\u00d7200 w/3:00",
    "description": "Track session: 8 repeats of 800m on a 5-minute cycle, then a 6-minute recovery, then 4 repeats of 200m with 3-minute rest (manual).",
    "sequence": [
      {
        "id": "b1",
        "type": "block",
        "label": "800m",
        "distanceM": 800,
        "reps": 8,
        "mode": "cycle",
        "workSeconds": 300,
        "restSeconds": 0
      },
      {
        "id": "j1",
        "type": "joiner",
        "joinerType": "rest",
        "label": "Recovery",
        "durationSeconds": 360,
        "skippable": true
      },
      {
        "id": "b2",
        "type": "block",
        "label": "200m",
        "distanceM": 200,
        "reps": 4,
        "mode": "manual",
        "restSeconds": 180
      }
    ]
  }
] as const;
