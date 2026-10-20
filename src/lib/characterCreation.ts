// Questions and preset answers for the character creator. Players can always write their own answer instead.
import type { CrawlerBackstory } from "@/lib/gameData";

export interface BackstoryQuestion {
  key: keyof CrawlerBackstory;
  label: string;       // Shown on the profile
  question: string;    // Shown in the creator
  hint: string;
  placeholder: string;
  presets: string[];
}

export const BACKSTORY_QUESTIONS: BackstoryQuestion[] = [
  {
    key: 'profession',
    label: 'Profession',
    question: 'What did you do for a living?',
    hint: 'An ordinary job from before the dungeon.',
    placeholder: 'e.g. Bug exterminator',
    presets: [
      'Bug exterminator', 'Used car salesman', 'Middle school gym teacher', 'Night shift security guard',
      'Line cook', 'Dental hygienist', 'Plumber', 'Barista', 'Insurance adjuster', 'Wedding DJ',
      'Mall Santa', 'Pizza delivery driver', 'Librarian', 'Roofer', 'Veterinary tech',
    ],
  },
  {
    key: 'accomplishment',
    label: 'Accomplishment',
    question: 'What is one thing you accomplished?',
    hint: "Small and real. \"3rd place at state in the 400m\" is fine, \"Olympic gold\" is not.",
    placeholder: 'e.g. Won 3rd place in the state high school 400m',
    presets: [
      'Won 3rd place in the state high school 400m',
      'Employee of the month, twice',
      'Finished a half marathon',
      'Won a county fair chili cook-off',
      'Got a black belt in karate at age 12',
      'Ate a 72 oz steak in under an hour',
      'Spelling bee regional runner-up',
      'Bowled a 250 game',
      'Paid off my car loan early',
      'Ran a successful lemonade stand for three summers',
    ],
  },
  {
    key: 'hobby',
    label: 'Hobby',
    question: 'What did you do for fun?',
    hint: 'Something you did on weekends.',
    placeholder: 'e.g. Bass fishing',
    presets: [
      'Bass fishing', 'Playing Dungeons & Dragons', 'Bird watching', 'Home brewing beer', 'Karaoke',
      'Rock climbing at the gym', 'Woodworking', 'Speedrunning video games', 'Gardening', 'Paintball',
      'Knitting', 'Geocaching', 'Bowling league', 'Baking sourdough',
    ],
  },
  {
    key: 'whenWorldEnded',
    label: 'When the world ended',
    question: 'Where were you when the world ended?',
    hint: 'What you were doing the moment everything collapsed.',
    placeholder: 'e.g. In the shower',
    presets: [
      'In the shower', "At a kid's birthday party", 'Mid-shift at the drive-thru', 'Stuck in traffic',
      'Asleep on the couch', 'In line at the DMV', 'On a first date', 'Walking the dog',
      'In the middle of a job interview', 'Mowing the lawn',
    ],
  },
  {
    key: 'mostImportant',
    label: 'Most important to you',
    question: 'Who or what is the most important person, thing or animal in the world to you?',
    hint: 'A person, a pet, or a thing you would fight for.',
    placeholder: 'e.g. My dog, Biscuit',
    presets: [
      'My little sister', 'My dog', 'My cat', 'My grandmother', 'My best friend since kindergarten',
      'My kid', 'My vintage pickup truck', "My dad's old pocket watch", 'My band', 'My girlfriend', 'My boyfriend',
    ],
  },
];

// Languages a new crawler can pick on top of Worldspeech. Mindspeech, Beast, Plant and Dead need a gift or a spell.
export const STARTING_LANGUAGE_PICKS = 2;
export const UNPICKABLE_STARTING_LANGUAGES = ['worldspeech', 'mindspeech', 'beast', 'plant', 'dead'];
