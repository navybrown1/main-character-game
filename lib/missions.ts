// MAIN CHARACTER, Season 1: Operation Homestead
// Mission dataset. Every entry is built from Edwin Brown's real notes.
// Rules: never invent obligations, never drop tasks, never change deadlines.
// Only the two periodontist dates are real deadlines. Nothing else gets one.

export type DistrictId =
  | 'clinic'
  | 'campus'
  | 'home-base'
  | 'vault'
  | 'arena'
  | 'market'
  | 'garage';

export type MissionType =
  | 'main'
  | 'quick'
  | 'chain'
  | 'boss'
  | 'expedition'
  | 'comms'
  | 'intel'
  | 'supply'
  | 'timed'
  | 'daily'
  | 'weekly'
  | 'campaign';

export type MissionFlag = 'veryImportant' | 'imperative' | 'tutorial';

export interface District {
  id: DistrictId;
  name: string;
  tagline: string;
  // Position of the district marker on the world map, in percent.
  mapX: number;
  mapY: number;
  // Mission that breaches this district. Districts without a gate start open.
  gateMissionId?: string;
}

export interface Mission {
  id: string;
  title: string;
  district: DistrictId;
  type: MissionType;
  brief: string;
  realWorldObjective: string;
  steps?: string[];
  xp: number;
  npc?: string;
  /** ISO datetime. Only set where a real date exists in the notes. */
  deadline?: string;
  flags?: MissionFlag[];
}

export interface Npc {
  id: string;
  name: string;
  role: string;
  line: string;
}

export interface IntelGap {
  id: string;
  note: string;
  context: string;
}

export const DISTRICTS: District[] = [
  {
    id: 'clinic',
    name: 'The Clinic',
    tagline: 'Patch yourself up. The mission needs you healthy.',
    mapX: 22,
    mapY: 30,
  },
  {
    id: 'campus',
    name: 'Campus',
    tagline: 'Degrees, the GI Bill, and the money printer.',
    mapX: 68,
    mapY: 22,
  },
  {
    id: 'home-base',
    name: 'Home Base',
    tagline: 'Hold the homestead.',
    mapX: 50,
    mapY: 52,
  },
  {
    id: 'vault',
    name: 'The Vault',
    tagline: 'Money in, money out. Every dollar accounted for.',
    mapX: 24,
    mapY: 72,
    gateMissionId: 'card-recon',
  },
  {
    id: 'arena',
    name: 'The Arena',
    tagline: 'The kids. The team. Game day.',
    mapX: 74,
    mapY: 64,
    gateMissionId: 'roster-invitation',
  },
  {
    id: 'market',
    name: 'The Market',
    tagline: 'Gear, tickets, and returns.',
    mapX: 44,
    mapY: 84,
    gateMissionId: 'supply-run-alpha',
  },
  {
    id: 'garage',
    name: 'The Garage',
    tagline: 'Local models, builds, and light shows.',
    mapX: 86,
    mapY: 42,
    gateMissionId: 'claw-hermes-approvals',
  },
];

export const MISSIONS: Mission[] = [
  // ------------------------------------------------------------- THE CLINIC
  {
    id: 'imperative-email',
    title: 'The Imperative Email',
    district: 'clinic',
    type: 'intel',
    brief:
      'Your notes mark one email IMPERATIVE, in all caps. Something in the NY Health inbox needs eyes on it right now.',
    realWorldObjective: 'Open and read the NY Health email marked imperative.',
    xp: 50,
    flags: ['imperative', 'tutorial'],
  },
  {
    id: 'periodontist-nov-12',
    title: 'The Chair: November 12',
    district: 'clinic',
    type: 'timed',
    brief:
      'First of two dates with the periodontist. 12:30 sharp. Show up, sit down, get it done.',
    realWorldObjective: 'Attend the periodontist appointment on November 12 at 12:30.',
    xp: 100,
    deadline: '2026-11-12T12:30:00',
  },
  {
    id: 'periodontist-nov-19',
    title: 'The Chair: November 19',
    district: 'clinic',
    type: 'timed',
    brief:
      'Round two. Same chair, same time. Finish what November 12 starts.',
    realWorldObjective: 'Attend the periodontist appointment on November 19 at 12:30.',
    xp: 100,
    deadline: '2026-11-19T12:30:00',
  },
  {
    id: 'health-dept-call',
    title: 'Call the Department',
    district: 'clinic',
    type: 'comms',
    brief:
      'The NY Department of Health does not call you. You call them. Get answers, get names, write them down.',
    realWorldObjective: 'Call the NY Department of Health.',
    xp: 60,
    npc: 'nydoh',
  },
  {
    id: 'placard-replacement',
    title: 'New Placard, No Excuses',
    district: 'clinic',
    type: 'main',
    brief:
      'The disability parking placard is broken. A broken placard is a ticket waiting to happen. Replace it.',
    realWorldObjective: 'Get a replacement disability parking placard.',
    xp: 120,
    npc: 'nydoh',
  },
  {
    id: 'lab-results',
    title: 'Lab Results Recon',
    district: 'clinic',
    type: 'intel',
    brief:
      'Numbers sitting in a portal somewhere. Read them, know where you stand.',
    realWorldObjective: 'Check your lab results.',
    xp: 40,
  },
  {
    id: 'missed-appointments',
    title: 'The Missed Appointments',
    district: 'clinic',
    type: 'main',
    brief:
      'Some appointments slipped. Track down every missed one and get them back on the books.',
    realWorldObjective: 'Follow up on missed medical appointments and rebook them.',
    xp: 100,
  },
  {
    id: 'va-appointments',
    title: 'VA Roll Call',
    district: 'clinic',
    type: 'chain',
    brief:
      'The VA schedule is a mess and some visits may have been missed. Full roll call, no one left behind.',
    realWorldObjective: 'Make sure all VA appointments are taken care of, including missed ones.',
    steps: [
      'List every VA appointment, past and upcoming',
      'Confirm the good ones, rebook the missed ones',
    ],
    xp: 150,
    npc: 'va-office',
  },

  // -------------------------------------------------------------- CAMPUS
  {
    id: 'gi-bill-cert',
    title: 'GI Bill Certification',
    district: 'campus',
    type: 'main',
    brief:
      'Your notes mark this VERY IMPORTANT, and they are right. No certification, no class money. This is the first main mission for a reason.',
    realWorldObjective: 'Make sure GI Bill certification is ready for class.',
    xp: 200,
    flags: ['veryImportant'],
  },
  {
    id: 'graduation-application',
    title: 'File for Graduation',
    district: 'campus',
    type: 'main',
    brief:
      'You do not graduate by accident. The application goes in, the paperwork moves, the degree gets closer.',
    realWorldObjective: 'Submit the graduation application.',
    xp: 150,
  },
  {
    id: 'fafsa-sweep',
    title: 'FAFSA Sweep',
    district: 'campus',
    type: 'chain',
    brief:
      'Free money has a deadline culture and a paper trail. Sweep the FAFSA tasks, then tear through the school email in detail so nothing hides.',
    realWorldObjective: 'Do the FAFSA tasks and check the school email in detail.',
    steps: ['Finish the FAFSA tasks', 'Check the school email in detail'],
    xp: 150,
  },
  {
    id: 'scholarship-hunt',
    title: 'Scholarship Hunt',
    district: 'campus',
    type: 'intel',
    brief:
      'Scholarships and income gains are out there, plus the blockers trying to stop them. Scout the terrain.',
    realWorldObjective: 'Check scholarships and income-gain opportunities and blockers.',
    xp: 80,
  },
  {
    id: 'gig-scout',
    title: 'Gig Scout',
    district: 'campus',
    type: 'intel',
    brief:
      'Three leads on the board: ChatGPT work, the Meta contributor program, and Contra, still locked. Plus free tokens wherever they hide.',
    realWorldObjective:
      'Check ChatGPT work opportunities, look into the Meta contributor program, unlock Contra, get more free tokens.',
    steps: [
      'Check ChatGPT work opportunities',
      'Look into the Meta contributor program',
      'Unlock Contra',
      'Get more free tokens',
    ],
    xp: 90,
  },
  {
    id: 'resume-ai',
    title: 'Resume: AI Division',
    district: 'campus',
    type: 'main',
    brief:
      'You are doing real AI work. The resume should say so, in plain language a hiring manager understands.',
    realWorldObjective: 'Add AI work to the resume.',
    xp: 120,
  },
  {
    id: 'money-hunt',
    title: 'Money Hunt',
    district: 'campus',
    type: 'main',
    brief:
      'Opportunities do not knock twice. Chase the money-making leads while they are warm.',
    realWorldObjective: 'Pursue money-making opportunities.',
    xp: 120,
  },
  {
    id: 'money-strategy',
    title: 'The Money Strategy',
    district: 'campus',
    type: 'campaign',
    brief:
      'Hustle without a plan is just motion. Build one actual money-making strategy and write it down.',
    realWorldObjective: 'Generate an actual money-making strategy.',
    xp: 220,
  },
  {
    id: 'student-benefits',
    title: 'Student Benefits Audit',
    district: 'campus',
    type: 'intel',
    brief:
      'Student status unlocks discounts, perks, and freebies most people never claim. Audit what is yours.',
    realWorldObjective: 'Check student benefits.',
    xp: 60,
  },
  {
    id: 'habit-stack',
    title: 'Habit Stack',
    district: 'campus',
    type: 'chain',
    brief:
      'Two books, one operating system for your brain. Read them, keep what works, install the habits.',
    realWorldObjective: 'Read Atomic Habits and The Power of Habit.',
    steps: ['Read Atomic Habits', 'Read The Power of Habit'],
    xp: 120,
  },

  // -------------------------------------------------------------- HOME BASE
  {
    id: 'housing-repairs',
    title: 'The Repairs Call',
    district: 'home-base',
    type: 'comms',
    brief:
      'Painting defects. Bathroom cabinets that were never fixed. Housing owes you a finished home. Make the call and get it on record.',
    realWorldObjective:
      'Call housing about outstanding repairs: painting defects and the bathroom cabinets that were never fixed.',
    xp: 100,
    npc: 'housing-office',
  },
  {
    id: 'lawn-duty',
    title: 'Lawn Duty',
    district: 'home-base',
    type: 'quick',
    brief: 'The grass does not cut itself. Quick, physical, satisfying.',
    realWorldObjective: 'Cut the grass.',
    xp: 40,
  },
  {
    id: 'bike-fix',
    title: 'Bike Shop: Home Edition',
    district: 'home-base',
    type: 'quick',
    brief: 'Your bicycle is down. Diagnose it, fix it, ride it.',
    realWorldObjective: 'Fix my bicycle.',
    xp: 50,
  },
  {
    id: 'wife-pc-rescue',
    title: 'PC Rescue',
    district: 'home-base',
    type: 'main',
    brief:
      "Your wife's computer is down and you are the IT department. Rescue the machine, save the day.",
    realWorldObjective: "Fix my wife's computer.",
    xp: 120,
  },
  {
    id: 'mail-check',
    title: 'Mail Call',
    district: 'home-base',
    type: 'daily',
    brief: 'Paper mail still moves the real world. Check the box.',
    realWorldObjective: 'Check physical mail.',
    xp: 25,
  },
  {
    id: 'suitcase-warranty',
    title: 'The Broken Wheel',
    district: 'home-base',
    type: 'supply',
    brief:
      'A suitcase with a broken wheel is a liability. Check the warranty and get it replaced or repaired.',
    realWorldObjective: 'Check the suitcase warranty (a wheel broke).',
    xp: 60,
  },
  {
    id: 'delta-credits',
    title: 'Delta Credits',
    district: 'home-base',
    type: 'quick',
    brief: 'Rideshare credits sitting unused are money evaporating. Spend them.',
    realWorldObjective: 'Use the Delta rideshare credits.',
    xp: 40,
  },

  // -------------------------------------------------------------- THE VAULT
  {
    id: 'card-recon',
    title: 'Card Recon',
    district: 'vault',
    type: 'chain',
    brief:
      'Before you touch a dollar, you map the territory. Every card, every balance, every due date, one wall of truth.',
    realWorldObjective:
      'Check the balance and due date of each credit card, then organize all card due dates in one place.',
    steps: [
      'Check the balance and due date of each credit card',
      'Organize all card due dates in one place',
    ],
    xp: 90,
  },
  {
    id: 'card-benefits-audit',
    title: 'Card Benefits Audit',
    district: 'vault',
    type: 'main',
    brief:
      'Every card is paying you to use it right. Audit each card’s benefits and route your spending like a strategist.',
    realWorldObjective: 'Review each credit card’s benefits to optimize spending.',
    xp: 120,
  },
  {
    id: 'pay-the-cards',
    title: 'Pay the Cards',
    district: 'vault',
    type: 'main',
    brief: 'Balances cleared, interest denied. Pay every card that is due.',
    realWorldObjective: 'Pay the credit cards.',
    xp: 150,
  },
  {
    id: 'rent-day',
    title: 'Rent Day',
    district: 'vault',
    type: 'main',
    brief: 'The roof stays over your head because rent gets paid. Handle it.',
    realWorldObjective: 'Pay rent.',
    xp: 100,
  },
  {
    id: 'prudential-premium',
    title: 'Prudential Premium',
    district: 'vault',
    type: 'quick',
    brief: 'Insurance only works if the premium is paid. Keep the coverage alive.',
    realWorldObjective: 'Pay Prudential insurance.',
    xp: 40,
  },
  {
    id: 'americu-sweep',
    title: 'AmeriCU Sweep',
    district: 'vault',
    type: 'main',
    brief:
      'Something on the AmeriCU card might be billing you for nothing. Sweep every charge and cancel anything unwanted.',
    realWorldObjective:
      'Review charges on the AmeriCU card and cancel anything unwanted.',
    xp: 120,
  },
  {
    id: 'amex-express',
    title: 'Amex Express',
    district: 'vault',
    type: 'quick',
    brief:
      'The Amex needs to be in your hands ASAP. Push the shipment, track it, receive it.',
    realWorldObjective: 'Get the Amex shipped ASAP.',
    xp: 40,
    flags: ['imperative'],
  },
  {
    id: 'usaa-claim',
    title: 'BOSS: The Claim Kraken',
    district: 'vault',
    type: 'boss',
    brief:
      'A USAA insurance claim sits unfiled, tentacles wrapped around money that is yours. Gather your papers, file the claim, and drag it into the light.',
    realWorldObjective: 'File the USAA insurance claim.',
    steps: ['Gather the policy info', 'File the claim', 'Track it to payout'],
    xp: 350,
  },
  {
    id: 'bluegreen-expedition',
    title: 'BOSS: The BlueGreen Leviathan',
    district: 'vault',
    type: 'boss',
    brief:
      'The BlueGreen vacation is a sleeping giant: money owed, points to save, a trip to book and actually use. Wake it on your terms.',
    realWorldObjective:
      'BlueGreen vacation: pay what is owed, save the points, book and use the vacation.',
    steps: [
      'Pay what is owed',
      'Save the points',
      'Book the vacation',
      'Use the vacation',
    ],
    xp: 450,
  },
  {
    id: 'dayanna-lifeline',
    title: "Dayanna's Lifeline",
    district: 'vault',
    type: 'comms',
    brief:
      'Dayanna has bills and there may be a nonprofit that can carry them. Find it and make the connection.',
    realWorldObjective: "Look into getting Dayanna's bills paid through a nonprofit.",
    xp: 100,
    npc: 'dayanna',
  },

  // -------------------------------------------------------------- THE ARENA
  {
    id: 'roster-invitation',
    title: 'Roster Invitation',
    district: 'arena',
    type: 'intel',
    brief:
      'The roster invitation is sitting in your email. Open it, confirm the boys, and the Arena opens its gates.',
    realWorldObjective: 'Check email for the roster invitation.',
    xp: 30,
  },
  {
    id: 'registration-blitz',
    title: 'Registration Blitz',
    district: 'arena',
    type: 'main',
    brief: 'No registration, no season. Get every form filed and every fee paid.',
    realWorldObjective: 'Complete the soccer registrations.',
    xp: 120,
  },
  {
    id: 'dental-patrol',
    title: 'Dental Patrol',
    district: 'arena',
    type: 'main',
    brief:
      'Teeth do not schedule themselves. Book dental appointments for the children, including baby Enzo.',
    realWorldObjective: 'Schedule dental appointments for the children including baby Enzo.',
    xp: 150,
  },
  {
    id: 'meds-run',
    title: 'Meds Run',
    district: 'arena',
    type: 'chain',
    brief:
      'Two-part op: call about Ethan’s medication, then hand-deliver it to his school. The nurse needs it, Ethan needs it.',
    realWorldObjective: 'Call about Ethan’s medication and drop it off at his school.',
    steps: ['Call about Ethan’s medication', 'Drop it off at his school'],
    xp: 120,
  },
  {
    id: 'vitamins-and-note',
    title: 'Vitamins and the Note',
    district: 'arena',
    type: 'supply',
    brief:
      'Stock the vitamins for the kids, then get the doctor’s note the school nurse needs for Ethan’s school.',
    realWorldObjective:
      'Buy vitamins for the kids and get a doctor’s note for the school nurse (Ethan’s school).',
    steps: ['Buy vitamins for the kids', 'Get the doctor’s note for the school nurse'],
    xp: 80,
  },
  {
    id: 'four-eyes-upgrade',
    title: 'Four Eyes Upgrade',
    district: 'arena',
    type: 'main',
    brief:
      'Ethan needs new glasses. You need new glasses. And your eyes need to be ready for soccer, glasses or contacts, your call.',
    realWorldObjective:
      'Get new glasses for Ethan and for Edwin, and get glasses or contact lenses so eyes are ready for soccer.',
    xp: 140,
  },
  {
    id: 'tina-brief',
    title: 'Brief Tina',
    district: 'arena',
    type: 'comms',
    brief:
      'Attorney Tina needs the email before anything moves. Send it clean, send it complete.',
    realWorldObjective:
      'Contact attorney Tina regarding Ethan’s mother: send her the email.',
    xp: 80,
    npc: 'tina',
    flags: ['veryImportant'],
  },
  {
    id: 'orlando-letter',
    title: 'The Orlando Letter',
    district: 'arena',
    type: 'chain',
    brief:
      'Two letters, one to Tina’s file and one to Ethan’s mother, including the one about the Orlando trip. Legal paper, handled right.',
    realWorldObjective:
      'Send the letter to Ethan’s mother, including the one about the Orlando trip.',
    steps: [
      'Send Tina the email about Ethan’s mother',
      'Send the letter to Ethan’s mother, including the Orlando trip letter',
    ],
    xp: 180,
    npc: 'tina',
    flags: ['veryImportant'],
  },
  {
    id: 'medicaid-check',
    title: 'Medicaid Check',
    district: 'arena',
    type: 'quick',
    brief: 'One verification stands between Enzo and covered care. Confirm it.',
    realWorldObjective: 'Make sure Enzo is on Medicaid.',
    xp: 40,
  },
  {
    id: 'jersey-text',
    title: 'Jersey Text',
    district: 'arena',
    type: 'comms',
    brief: 'Jenn co-coaches the team and needs the jersey word. Text her about the kids’ jerseys.',
    realWorldObjective: 'Text Jenn about the kids’ jerseys.',
    xp: 30,
    npc: 'jenn',
  },
  {
    id: 'jersey-design',
    title: 'Jersey Design',
    district: 'arena',
    type: 'campaign',
    brief:
      'The team needs a look. Design the new team jersey, something the kids will actually want to wear.',
    realWorldObjective: 'Design the new team jersey.',
    xp: 150,
  },
  {
    id: 'school-paperwork',
    title: 'School Paperwork Sweep',
    district: 'arena',
    type: 'main',
    brief:
      'The boys’ school stuff is piling up, including the disability paperwork from school. Sweep it all into order.',
    realWorldObjective:
      'Check the boys’ school stuff including the disability paperwork from school.',
    xp: 100,
  },
  {
    id: 'bible-app',
    title: 'Bible App Install',
    district: 'arena',
    type: 'quick',
    brief: 'Small install, big win for the kids. Get the Bible app on their devices.',
    realWorldObjective: 'Download the Bible app for the kids.',
    xp: 25,
  },
  {
    id: 'amazon-gear-run',
    title: 'Amazon Gear Run',
    district: 'arena',
    type: 'supply',
    brief:
      'The cart is already written: baseball gloves, cleats for both kids, and a phone case. Check out.',
    realWorldObjective:
      'Buy on Amazon: baseball gloves, cleats for both kids, a phone case.',
    steps: ['Baseball gloves', 'Cleats for both kids', 'A phone case'],
    xp: 100,
  },

  // -------------------------------------------------------------- THE MARKET
  {
    id: 'supply-run-alpha',
    title: 'Supply Run Alpha',
    district: 'market',
    type: 'supply',
    brief:
      'First run into the Market: sunglasses, printer ink, a wifi adapter, and AirPods tips. Four items, one checkout, gates open.',
    realWorldObjective: 'Buy sunglasses, printer ink, a wifi adapter, AirPods tips.',
    steps: ['Sunglasses', 'Printer ink', 'Wifi adapter', 'AirPods tips'],
    xp: 80,
  },
  {
    id: 'tech-upgrades',
    title: 'Tech Upgrades',
    district: 'market',
    type: 'supply',
    brief: 'Your setup deserves better input and better light. Keyboard and smart lights, acquired.',
    realWorldObjective: 'Buy a new Bluetooth keyboard and smart lights.',
    steps: ['New Bluetooth keyboard', 'Smart lights'],
    xp: 80,
  },
  {
    id: 'camera-quest',
    title: 'Camera Quest',
    district: 'market',
    type: 'expedition',
    brief:
      'A camera is not a gadget, it is a memory machine. Research it, pick it, buy it.',
    realWorldObjective: 'Buy a camera.',
    xp: 140,
  },
  {
    id: 'honduras-tickets',
    title: 'Honduras Tickets',
    district: 'market',
    type: 'expedition',
    brief: 'Honduras is calling. Lock in the tickets before prices move.',
    realWorldObjective: 'Buy tickets for Honduras.',
    xp: 220,
  },
  {
    id: 'sams-club',
    title: "Sam's Club Card",
    district: 'market',
    type: 'quick',
    brief: 'Bulk prices, one membership. Get the Sam’s Club subscription.',
    realWorldObjective: 'Get a Sam’s Club subscription.',
    xp: 40,
  },
  {
    id: 'ezpass',
    title: 'EZ Pass Transponder',
    district: 'market',
    type: 'quick',
    brief: 'Tolls should be invisible. Get the new EZ Pass transponder mounted.',
    realWorldObjective: 'Get a new EZ Pass transponder.',
    xp: 40,
  },
  {
    id: 'eye-mask-exchange',
    title: 'Eye Mask Exchange',
    district: 'market',
    type: 'supply',
    brief: 'The eye mask is not right. Exchange it for one that is.',
    realWorldObjective: 'Exchange the eye mask.',
    xp: 40,
  },
  {
    id: 'ball-returns',
    title: 'The Ball Returns',
    district: 'market',
    type: 'chain',
    brief:
      'Three pieces of gear failed you: a deflated ball, a torn ball, and cleats that do not fit. March them all back.',
    realWorldObjective:
      'Return or exchange the deflated soccer ball, the torn soccer ball, and the unsuitable soccer cleats.',
    steps: [
      'Return or exchange the deflated soccer ball',
      'Return or exchange the torn soccer ball',
      'Return or exchange the unsuitable soccer cleats',
    ],
    xp: 100,
  },

  // -------------------------------------------------------------- THE GARAGE
  {
    id: 'claw-hermes-approvals',
    title: 'Systems Green',
    district: 'garage',
    type: 'main',
    brief:
      'OpenClaw and Hermes are waiting on pending approvals. Clear the queue and bring both systems to ready.',
    realWorldObjective:
      'Get pending approvals done in OpenClaw and Hermes so they are ready to go.',
    xp: 120,
  },
  {
    id: 'local-models-lab',
    title: 'Local Models Lab',
    district: 'garage',
    type: 'main',
    brief:
      'Computer use, tested on every local model you run. Benchmark them all and know which one earns the job.',
    realWorldObjective: 'Test computer use on all local models.',
    xp: 150,
  },
  {
    id: 'tessie-build',
    title: 'BOSS: Tessie Prime',
    district: 'garage',
    type: 'boss',
    brief:
      'The Tessie app is the big build, the one that proves the Garage is more than a workshop. Ship it.',
    realWorldObjective: 'Build the Tessie app.',
    xp: 400,
  },
  {
    id: 'tesla-light-show',
    title: 'Tesla Light Show',
    district: 'garage',
    type: 'campaign',
    brief:
      'New car paintings, new songs, one unforgettable light show. The Tesla becomes a stage.',
    realWorldObjective: 'Create new car paintings and songs for the Tesla light show.',
    steps: ['Create new car paintings', 'Create new songs for the light show'],
    xp: 220,
  },
];

export const NPCS: Npc[] = [
  {
    id: 'tina',
    name: 'Tina',
    role: 'Attorney',
    line: 'Send me the email first. Then we move on the letter.',
  },
  {
    id: 'jenn',
    name: 'Jenn',
    role: "Kids' other soccer coach",
    line: 'Jerseys. Sizes. Go.',
  },
  {
    id: 'dayanna',
    name: 'Dayanna',
    role: 'Family friend',
    line: 'The bills keep coming. Find me a way through.',
  },
  {
    id: 'housing-office',
    name: 'Housing Office',
    role: 'Repairs and maintenance',
    line: 'Work orders are in the system. Call to push them.',
  },
  {
    id: 'nydoh',
    name: 'NY Dept of Health',
    role: 'State health office',
    line: 'Have your case details ready before you call.',
  },
  {
    id: 'va-office',
    name: 'VA Office',
    role: 'Veterans appointments',
    line: 'We can rebook what was missed. Bring the list.',
  },
];

// Unresolved intel from the notes. Surfaced in game, never resolved by guessing.
// The player can attach their own clarification; the game never auto-resolves.
export const INTEL_GAPS: IntelGap[] = [
  {
    id: 'gap-black-card',
    note: 'Get a replacement, black heart, black card, black card sign for disability the blue one',
    context: 'July 30 note, garbled. Possibly related to the disability placard.',
  },
  {
    id: 'gap-ussa',
    note: 'USSA insurance must be claimed',
    context: 'September 5 note. Assumed USAA. Which claim is unknown.',
  },
  {
    id: 'gap-eye-mask',
    note: 'Exchange my eyes mask',
    context: 'Title only, body unreadable.',
  },
  {
    id: 'gap-family-friends',
    note: 'Certainly get ahold to Family and Friends',
    context: '2023 note, corrupted.',
  },
  {
    id: 'gap-bibble',
    note: 'Download app bibble for kids',
    context: 'Assumed to be the Bible app.',
  },
  {
    id: 'gap-americu',
    note: 'Americu card',
    context: 'Assumed AmeriCU credit union.',
  },
  {
    id: 'gap-soccer-eyes',
    note: 'Get the medium to get my eyes ready to play soccer',
    context: 'The note’s own clarification suggests glasses or lenses.',
  },
];

export const missionById = (id: string): Mission | undefined =>
  MISSIONS.find((m) => m.id === id);

export const districtById = (id: DistrictId): District =>
  DISTRICTS.find((d) => d.id === id) as District;

export const npcById = (id: string): Npc | undefined =>
  NPCS.find((n) => n.id === id);

export const missionsForDistrict = (district: DistrictId): Mission[] =>
  MISSIONS.filter((m) => m.district === district);

export const missionsForNpc = (npcId: string): Mission[] =>
  MISSIONS.filter((m) => m.npc === npcId);

export const TOTAL_XP: number = MISSIONS.reduce((sum, m) => sum + m.xp, 0);
