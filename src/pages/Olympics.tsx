import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { SportsContent } from '../types';
import { FALLBACK_SPORTS_CONTENT } from '../lib/fallbackData';
import { 
  Trophy, Play, Plus, Trash2, Flame, Award, Calendar, Timer, 
  Check, X, Compass, Share2, ExternalLink, Heart, Tv, Video, History, Sparkles, BookOpen,
  Search, ArrowLeft, Quote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';

// Type definitions for custom added videos
interface CustomOlympicVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
  views: number;
  likes: number;
}

// Default pre-populated high-quality Olympic highlight/clip selections
const DEFAULT_VIDEOS: CustomOlympicVideo[] = [
  {
    id: 'olympic-archery',
    title: 'Olympic Archery Individual Finals - High Precision Highlights',
    description: 'Experience the extreme concentration and precision of the Olympic individual finals match. Athletes battle millimeter by millimeter in a breathtaking final set.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', // Safe public video URL
    duration: '0:52',
    views: 124300,
    likes: 8520
  },
  {
    id: 'olympic-sprint',
    title: 'Historic 100m Athletics Final - Golden Run',
    description: 'Relive the speed, tension, and glory of the ultimate Summer Games track event as competitors sprint for legendary gold in front of 80,000 spectators.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: '0:15',
    views: 310500,
    likes: 24310
  },
  {
    id: 'olympic-swimming',
    title: 'Men\'s 4x100m Medley Relay Spectacular',
    description: 'Watch the epic final lap of the medley relay where world record holders push the boundaries of human speed in the pool.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: '0:14',
    views: 198400,
    likes: 12050
  },
  {
    id: 'olympic-skate',
    title: 'Winter Olympics Extreme Slopes Showcase',
    description: 'Breathtaking snowboard halfpipe and big air action from the slopes. Athletes execute gravity-defying quad-corks and spins under freezing skies.',
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutback.mp4',
    duration: '1:00',
    views: 89400,
    likes: 5890
  }
];

// Detailed dataset of historic and recent Indian Olympic Medalists
export interface IndianMedalist {
  id: string;
  name: string;
  sport: string;
  medals: {
    year: string;
    type: 'gold' | 'silver' | 'bronze';
    detail: string;
  }[];
  avatar: string;
  category: string;
  bio: string;
  image: string;
  longDetails: string[];
  quote?: string;
  funFact?: string;
  moments: {
    title: string;
    description: string;
    image: string;
  }[];
  timeline?: {
    year: string;
    title: string;
    description: string;
  }[];
}

export const INDIAN_MEDALISTS: IndianMedalist[] = [
  {
    id: "norman-pritchard",
    name: "Norman Pritchard",
    sport: "Athletics (200m & 200m Hurdles)",
    medals: [
      { year: "Paris 1900", type: "silver", detail: "Men's 200m Silver Medal" },
      { year: "Paris 1900", type: "silver", detail: "Men's 200m Hurdles Silver Medal" }
    ],
    avatar: "🏃‍♂️",
    category: "Athletics",
    bio: "The first Asian-born athlete to win an Olympic medal, securing two historic silvers at Paris 1900.",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Norman Pritchard was a British-Indian athlete and actor who wrote the very first chapter of India's Olympic legacy. Born in Calcutta, he was an extraordinary sprinter and hurdler.",
      "At the Paris 1900 Games, Pritchard competed representing India. He stormed his way to the finals of both the Men's 200m and the Men's 200m Hurdles, winning a brilliant Silver medal in both events.",
      "With these achievements, Pritchard became the first athlete representing an Asian nation to win an Olympic medal, establishing a historic milestone."
    ],
    quote: "To run is to feel the heartbeat of history, pushing the boundary of human speed.",
    funFact: "After his athletic career, Pritchard moved to the United States where he became a successful silent Hollywood film actor under the screen name Colin Clive!",
    moments: [
      {
        title: "Paris 1900 Milestone",
        description: "Competing on the absolute world athletic stage, setting the speed bar for future generations.",
        image: "https://images.unsplash.com/photo-1502224562085-639556652f33?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "1900", title: "Paris Olympic Dual Silver", description: "Claims silver in both the Men's 200m sprint and 200m Hurdles representing India." },
      { year: "1905", title: "Hollywood Journey", description: "Emigrates to the United States to pursue a career in movies and Broadway theater." }
    ]
  },
  {
    id: "neeraj-chopra",
    name: "Neeraj Chopra",
    sport: "Athletics (Javelin Throw)",
    medals: [
      { year: "Tokyo 2020", type: "gold", detail: "87.58m historic gold throw" },
      { year: "Paris 2024", type: "silver", detail: "89.45m season-best silver throw" }
    ],
    avatar: "🏅",
    category: "Athletics",
    bio: "The first Indian track-and-field athlete to win an Olympic gold medal, and India's second individual gold medalist.",
    image: "https://images.unsplash.com/photo-1541252260730-0412e8e2108e?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Neeraj Chopra rose from the humble village of Khandra in Haryana to become India's absolute track-and-field icon. From pick-up javelin practice to entering the world athletics stage, his ascent has been legendary.",
      "In Tokyo 2020, Neeraj shocked the world field by leading right from his opening throw, securing the gold medal with a massive 87.58 meter release of raw power, perfect technique, and clinical composure. It was India's first track-and-field gold.",
      "In Paris 2024, despite battling a nagging groin pull and persistent muscle soreness, he delivered yet another clutch highlight. Releasing a beautiful 89.45 meter season-best throw on his second attempt, he secured a historic silver medal place, solidifying his standing as India's most consistent big-stage performer."
    ],
    quote: "We throw the javelin with our mind and heart, not just our arms.",
    funFact: "Neeraj initially took up sports purely to lose weight when he was a teenager, after his family encouraged him to get active.",
    moments: [
      {
        title: "The Golden Arc (Tokyo 2020)",
        description: "Neeraj releases the javelin with absolute perfection, raising his arms in instant celebration before it even lands.",
        image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: "The Resilience of Silver (Paris 2024)",
        description: "Overcoming physical setbacks during the final phase to pull off an 89.45m strike on the grandest stage.",
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2018", title: "Double Gold Breakthrough", description: "Wins Gold at both the Commonwealth Games in Gold Coast and the Asian Games in Jakarta." },
      { year: "2021", title: "Olympic Gold in Tokyo", description: "Stuns the athletic world by claiming India's first track and field Olympic Gold." },
      { year: "2023", title: "World Athletics Champion", description: "Claims Gold in Budapest, cementing himself as World Champion." },
      { year: "2024", title: "Paris Olympics Silver", description: "Battles injury to land a season-best 89.45m throw for silver." }
    ]
  },
  {
    id: "abhinav-bindra",
    name: "Abhinav Bindra",
    sport: "Shooting (10m Air Rifle)",
    medals: [
      { year: "Beijing 2008", type: "gold", detail: "India's first-ever individual Olympic gold medal" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "Historic shooter who shot a near-perfect score in the 10m Air Rifle finals to secure India's first primary individual gold.",
    image: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Abhinav Bindra of Dehradun pioneered personal greatness for India at the Olympics. Obsessed with detail and absolute perfection, Bindra spent years fine-tuning every single element of his rifle alignment, breathing patterns, and heart rate control.",
      "At the Beijing 2008 Games, Bindra entered the final rounds tied with world champions. With absolute cold-blooded focus under extreme pressure, he shot a near-perfect 10.8 on his final attempt to steal the historic Gold Medal.",
      "His victory broke a long drought and proved to a generation of Indian athletes that individual Olympic gold was possible with scientific rigor and sheer willpower."
    ],
    quote: "Practice is a comfort zone; competition is where you test your limits.",
    funFact: "Bindra built a custom shooting range in his backyard and hired a brain mapping specialist to simulate stressful environments during sport training.",
    moments: [
      {
        title: "The 10.8 Final Beam",
        description: "With his final shot under colossal pressure, he strikes the target almost dead-center to clinch the top podium.",
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2006", title: "World Championship Gold", description: "Becomes World Champion in Zagreb with standard gold victory." },
      { year: "2008", title: "Beijing Olympic Gold", description: "Launches himself into history as India's first-ever individual Olympic gold medalist." },
      { year: "2014", title: "Glasgow Commonwealth Gold", description: "Clinches gold in his final Commonwealth Games appearance." }
    ]
  },
  {
    id: "manu-bhaker",
    name: "Manu Bhaker",
    sport: "Shooting (10m Air Pistol)",
    medals: [
      { year: "Paris 2024", type: "bronze", detail: "Women's 10m Air Pistol bronze" },
      { year: "Paris 2024", type: "bronze", detail: "Mixed 10m Air Pistol team bronze with Sarabjot" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "The first athlete of independent India to win two medals in a single edition of the Olympic Games.",
    image: "https://images.unsplash.com/photo-1504221507732-5246c045949b?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Manu Bhaker, hailing from Haryana, is India's shooting sensation who wrote an unprecedented comeback story at the Paris 2024 Olympic Games.",
      "After facing heartbreaking gun design failures and malfunctions during her debut in Tokyo 2020 which drew harsh criticism from media, Manu completely rebuilt her mental resilience by diving deep into Bhagavad Gita teachings and intense focus training.",
      "In Paris 2024, she secured bronze in the Women's 10m Air Pistol. She then teamed up with partner Sarabjot Singh to earn another brilliant bronze in the mixed-team event, making her the first athlete of independent India to win multiple medals in a single Olympic edition."
    ],
    quote: "I just focus on my process and keep my eyes locked on the target. The results follow on their own.",
    funFact: "Manu is highly multi-talented and excelled in violin, tennis, skating, and even a form of traditional boxing before discovering shooting at her boarding school.",
    moments: [
      {
        title: "Redemption at Paris 2024",
        description: "Manu displays intense focus during her first bronze medal round to finish amongst the top three.",
        image: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: "The Golden Partners",
        description: "Manu Bhaker alongside Sarabjot Singh celebrating their mixed team bronze triumph.",
        image: "https://images.unsplash.com/photo-1519766304817-4f37bda74a27?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2018", title: "Commonwealth Gold at 16", description: "Becomes the youngest Indian to win a gold medal at the Commonwealth Games." },
      { year: "2023", title: "World Championship Gold", description: "Wins Team Gold in the 25m Pistol at Baku." },
      { year: "2024", title: "Paris Olympic Historic Double", description: "Wins two bronze medals, becoming a household legend across India." }
    ]
  },
  {
    id: "pv-sindhu",
    name: "PV Sindhu",
    sport: "Badminton (Women's Singles)",
    medals: [
      { year: "Rio 2016", type: "silver", detail: "Sensational badminton singles final run" },
      { year: "Tokyo 2020", type: "bronze", detail: "Dominant straight-sets bronze match" }
    ],
    avatar: "🏸",
    category: "Badminton",
    bio: "One of India's most decorated individual Olympians, maintaining supreme consistency over consecutive Games.",
    image: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Pusarla Venkata Sindhu is a synonym for big-game greatness in international badminton. Consistently rising to the occasion, her offensive aggression, deep baseline clears, and tall reach have made her one of India's greatest athletic icons.",
      "Her Rio 2016 campaign was an absolute firecracker run, displacing top-ranked global elites before fighting a brutal, dramatic final against Carolina Marin to secure a historic Silver.",
      "In Tokyo 2020, she continued her legacy of consistency by fighting back from a painful semifinal loss to capture a dominant straight-sets bronze, becoming only the second individual Indian athlete to win consecutive medals."
    ],
    quote: "The greatest asset you have is your mental strength on court.",
    funFact: "During training, PV Sindhu was completely banned from eating sweet curd, ice cream, and keeping her mobile phone for nearly eight months leading to Rio.",
    moments: [
      {
        title: "The Rio Silver Smash",
        description: "Sindhu leaps high into the air, unleashing her signature cross-court smash.",
        image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: "Second Consecutive Glory",
        description: "Celebrating with emotional pride as she receives her Tokyo 2020 bronze medal.",
        image: "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2016", title: "Rio Olympics Silver", description: "Becomes the youngest Indian to win an Olympic silver medal with an epic badminton run." },
      { year: "2019", title: "World Championship Gold", description: "Claims the World Title in Basel, defeating Nozomi Okuhara in a dominating final." },
      { year: "2021", title: "Tokyo Olympics Bronze", description: "Secures her second consecutive Olympic medal with a clinical win path." }
    ]
  },
  {
    id: "sushil-kumar",
    name: "Sushil Kumar",
    sport: "Wrestling (Men's Freestyle)",
    medals: [
      { year: "Beijing 2008", type: "bronze", detail: "66kg Wrestling bronze" },
      { year: "London 2012", type: "silver", detail: "66kg Wrestling silver final" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "India's trail-blazing wrestler who proved consecutive podium finishes were possible for freestyle wrestling.",
    image: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Sushil Kumar pioneered the modern freestyle wrestling revolution in India. Training in the legendary Akharas of Delhi, he demonstrated that Indian wrestlers could match global powerhouses in strength, leverage, and speed.",
      "At Beijing 2008, he battled through exhausting repechage rounds to clinch a monumental bronze medal. Re-energized and determined, he stepped onto the London 2012 mat, carrying India's flag at the opening ceremony and fighting his way to a supreme silver podium place.",
      "His mental conditioning on the mat inspired wrestlers like Ravi Dahiya and Bajrang Punia to pursue Olympic medals."
    ],
    quote: "Wrestling is in our blood. The Akhara taught me that pain is temporary, but glory is forever.",
    funFact: "Sushil had to practice with sandbags and pull heavy tractors during his early training routines in rural fields.",
    moments: [
      {
        title: "Beijing Repechage Sweep",
        description: "Fierce victory in three consecutive matches inside 70 minutes to win bronze.",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2008", title: "Beijing Olympics Bronze", description: "First Indian wrestling medal in 56 years." },
      { year: "2010", title: "World Championship Gold", description: "First Indian to win a championship gold in freestyle wrestling." },
      { year: "2012", title: "London Olympics Silver", description: "First Indian to achieve back-to-back individual podium finishes." }
    ]
  },
  {
    id: "indian-hockey",
    name: "Indian Men's Hockey Team",
    sport: "Field Hockey",
    medals: [
      { year: "Paris 2024", type: "bronze", detail: "Consecutive bronze, defeated Spain 2-1" },
      { year: "Tokyo 2020", type: "bronze", detail: "Ended 40-year Olympic hockey medal drought" },
      { year: "Moscow 1980", type: "gold", detail: "8th historic Gold, defeated Spain 4-3 in final" },
      { year: "Munich 1972", type: "bronze", detail: "Bronze medal finish, defeated Netherlands 2-1" },
      { year: "Mexico City 1968", type: "bronze", detail: "Bronze medal finish, defeated West Germany 2-1" },
      { year: "Tokyo 1964", type: "gold", detail: "7th Gold, defeated Pakistan 1-0 in tight final" },
      { year: "Rome 1960", type: "silver", detail: "Silver medal podium finish, close 0-1 vs Pakistan" },
      { year: "Melbourne 1956", type: "gold", detail: "6th Gold, defeated Pakistan 1-0 in final" },
      { year: "Helsinki 1952", type: "gold", detail: "5th Gold, Balbir Singh Sr. scored 5 in 6-1 final vs Netherlands" },
      { year: "London 1948", type: "gold", detail: "4th Gold, first as independent nation, 4-0 vs Great Britain" },
      { year: "Berlin 1936", type: "gold", detail: "3rd Gold under wizard Major Dhyan Chand, 8-1 vs Germany" },
      { year: "Los Angeles 1932", type: "gold", detail: "2nd Gold, record-breaking 24-1 victory over USA" },
      { year: "Amsterdam 1928", type: "gold", detail: "1st Olympic Gold, debuted with flawless zero goals conceded" }
    ],
    avatar: "🏑",
    category: "Hockey",
    bio: "The most successful hockey team in Olympic history, with an unparalleled record of 8 gold medals.",
    image: "https://images.unsplash.com/photo-1580748141549-71748d60bdc5?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Indian Men's Field Hockey is the absolute crown jewel of the nation's sporting history. Domination in field hockey was unprecedented, capturing a total of 8 Gold Medals and demonstrating a wizardry on turf that left other nations spellbound.",
      "After a heartbreaking 40-year medal drought, a new era emerged with a thrilling, hard-fought bronze medal win at the Tokyo 2020 Games, reinstating Hockey as the pride of the nation.",
      "In Paris 2024, they repeated history by winning back-to-back bronze medals with key heroic saves from veteran goalkeeper PR Sreejesh and high-pressure penalty corner strikes, celebrating a beautiful tribute to Indian sportsmanship."
    ],
    quote: "Wearing the India jersey and carrying hockey back onto the Olympic podium is our greatest honor.",
    funFact: "During the golden era, legendary wizard Major Dhyan Chand's hockey stick was broken by authorities to check if there was a magnet hidden inside.",
    moments: [
      {
        title: "Moscow 1980 Supremacy",
        description: "Thrilling victory over Spain to win India's eighth Olympic hockey gold medal.",
        image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: "The Wall in Paris 2024",
        description: "Sreejesh delivers clutch blocks against Spain to secure the bronze medal.",
        image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "1928", title: "Amsterdam Debut Gold", description: "India enters gold arena with zero goals conceded throughout tournament." },
      { year: "1932", title: "Los Angeles Record", description: "Secures second gold with an outstanding 24-1 victory against USA." },
      { year: "1936", title: "Berlin Hat-Trick", description: "Led by Major Dhyan Chand, securing a historic third gold with 8-1 vs Germany." },
      { year: "1948", title: "London Independent Gold", description: "Wins first Olympic Gold for Independent India, defeating Great Britain 4-0 at Wembley." },
      { year: "1952", title: "Helsinki Glory", description: "Balbir Singh Sr. scores 5 goals in final to claim fifth consecutive gold." },
      { year: "1956", title: "Melbourne Six-in-a-row", description: "Clinched sixth consecutive Olympic Gold defeating Pakistan 1-0." },
      { year: "1960", title: "Rome Olympic Silver", description: "Secures silver after a close finale encounter." },
      { year: "1964", title: "Tokyo Gold Recovery", description: "Regains the Gold title in Tokyo after beating Pakistan 1-0." },
      { year: "1968-1972", title: "Mexico & Munich Bronzes", description: "Stays on the podium with back-to-back dynamic third-place finishes." },
      { year: "1980", title: "Moscow Eighth Gold", description: "The ultimate historic eighth Gold medal under captain Vasudevan Baskaran." },
      { year: "2021", title: "Tokyo Comeback Bronze", description: "Thrilling 5-4 victory over Germany to break the 40-year medal drought." },
      { year: "2024", title: "Paris Double Bronze", description: "Back-to-back Bronze, crowning Sreejesh's legendary goalkeeping career." }
    ]
  },
  {
    id: "mirabai-chanu",
    name: "Mirabai Chanu",
    sport: "Weightlifting (49kg Category)",
    medals: [
      { year: "Tokyo 2020", type: "silver", detail: "Lifting a total of 202kg to bag silver" }
    ],
    avatar: "🏋️‍♀️",
    category: "Weightlifting",
    bio: "An inspirational weightlifter who overcame injuries to open India's medal tally on day one of Tokyo 2020.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Saikhom Mirabai Chanu is India's premier female weightlifter, representing Manipur on the highest global podium. Overcoming physical hardships, severe back issues, and the stinging disappointment of failed lifts in Rio, she redefined perseverance.",
      "In Tokyo 2020, Mirabai opened India's medal tally on day one of competition. By lifting a stunning total of 202kg (87kg Snatch and 115kg Clean & Jerk), she secured an electric Silver medal."
    ],
    quote: "If you believe in your training and stay dedicated, even the heaviest weights will become light.",
    funFact: "As a child, Mirabai was noticed for her strength when she easily carried huge bundles of firewood that her older brother struggled to lift.",
    moments: [
      {
        title: "Overhead Lift of Destiny",
        description: "Clenching the barbell overhead with immense strength to claim Silver.",
        image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2017", title: "World Championship Gold", description: "Gold medal in 48kg category in Anaheim." },
      { year: "2018", title: "Commonwealth Games Gold", description: "Spectacular performance setting event records." },
      { year: "2021", title: "Tokyo Olympics Silver", description: "A historic day-one medal for India." }
    ]
  },
  {
    id: "mary-kom",
    name: "Mary Kom",
    sport: "Boxing (Flyweight)",
    medals: [
      { year: "London 2012", type: "bronze", detail: "Historic debut of women's boxing at the Olympics" }
    ],
    avatar: "🥊",
    category: "Boxing",
    bio: "Six-time World Champion who captured the hearts of millions by winning bronze in the historic London 2012 games.",
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Chungneijang Mary Kom Hmangte, popular as 'Magnificent Mary', is one of boxing's absolute global legends. A pioneer in women's sports, she balanced motherhood and rigorous training, overcoming financial limitations to dominate flyweight boxing.",
      "When women's flyweight boxing debuted at London 2012, Mary stepped into the ring and won a historic bronze medal, securing her place in athletic history."
    ],
    quote: "Don't say you are weak because you are a woman. Fight and let your fists speak for your spirit.",
    funFact: "Mary initially hid her boxing training from her father for years, who only discovered her passion when he saw her photo in a newspaper after she won a state championship.",
    moments: [
      {
        title: "London Flyweight Semi-final",
        description: "Fierce punch exchange in the Olympic ring facing world-class competition.",
        image: "https://images.unsplash.com/photo-1509563268479-0f004cf3f58b?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2002-2018", title: "Six-Time World Champion", description: "An unparalleled record in world boxing competition." },
      { year: "2012", title: "London Olympics Bronze", description: "The historic debut and podium finish in Olympic boxing." },
      { year: "2014", title: "Incheon Asian Games Gold", description: "First Indian female boxer to win gold." }
    ]
  },
  {
    id: "saina-nehwal",
    name: "Saina Nehwal",
    sport: "Badminton (Women's Singles)",
    medals: [
      { year: "London 2012", type: "bronze", detail: "India's first Olympic medal in badminton" }
    ],
    avatar: "🏸",
    category: "Badminton",
    bio: "A true pioneer who accelerated the growth of badminton popularity throughout India by securing her bronze podium finish.",
    image: "https://images.unsplash.com/photo-1511067007398-7e4b90cfa4bc?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Saina Nehwal is India's initial badminton trailblazer, whose grit and focus accelerated the entire sport's growth in India.",
      "At London 2012, Saina maintained absolute composure under intense national pressure to win the bronze medal, delivering India's first-ever Olympic medal in badminton."
    ],
    quote: "You have to work when nobody is watching. True champions are made in the silence of practice.",
    funFact: "To support her badminton dreams, Saina's father used to travel over 50 kilometers in the early hours of Hyderabad mornings on a scooter to drop her at the camp.",
    moments: [
      {
        title: "London Badminton Triumph",
        description: "Striking the shuttlecock in her clinical podium-deciding match.",
        image: "https://images.unsplash.com/photo-1613531415875-16135b829860?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2009", title: "Super Series Breakthrough", description: "Wins Indonesia Open, showing she could defeat top Chinese elites." },
      { year: "2012", title: "London Olympics Bronze", description: "A breakthrough bronze for Indian racket sports." },
      { year: "2015", title: "World Number One", description: "Becomes the first Indian female badminton player to be ranked World No. 1." }
    ]
  },
  {
    id: "ravi-dahiya",
    name: "Ravi Kumar Dahiya",
    sport: "Wrestling (57kg Freestyle)",
    medals: [
      { year: "Tokyo 2020", type: "silver", detail: "Epic semi-final pin-down and final fight" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "Fierce freestyle wrestler known for his incredible endurance, who fought back from a huge deficit in the semi-finals.",
    image: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Ravi Kumar Dahiya is a powerhouse freestyle wrestler who epitomizes endurance and stamina. Coming from the wrestling nurseries of Nahri village, Ravi spent years practicing in intense clay pits.",
      "In the Tokyo 2020 57kg freestyle semi-final, Ravi pulled off one of the greatest comebacks in Olympic wrestling history. Facing a huge point deficit and a rival who bit his arm under pressure, Ravi pinned his opponent down to secure a historic spot in the final, ultimately claiming a Silver medal."
    ],
    quote: "Once I enter the mat, I don't think about pain. I only think about my country's flag.",
    funFact: "During early days, Ravi's father used to travel 40km everyday from his village to the stadium to bring fresh milk and homemade butter for his diet.",
    moments: [
      {
        title: "The Epic Semifinal Pin",
        description: "Stunning pin-fall comeback victory that shocked the entire wrestling arena.",
        image: "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2019", title: "World Championship Bronze", description: "Secures qualification place for Tokyo 2020." },
      { year: "2020", title: "Three-Time Asian Champion", description: "Supreme gold domination in Asian wrestling circuits." },
      { year: "2021", title: "Tokyo Olympics Silver", description: "Battles all the way to a Silver medal on debut." }
    ]
  },
  {
    id: "lovlina-bourgohain",
    name: "Lovlina Borgohain",
    sport: "Boxing (Welterweight)",
    medals: [
      { year: "Tokyo 2020", type: "bronze", detail: "Spirited run in the welterweight division" }
    ],
    avatar: "🥊",
    category: "Boxing",
    bio: "Powerhouse boxer from Assam who carved her way to the semi-finals in her debut Olympic appearance.",
    image: "https://images.unsplash.com/photo-1509563268479-0f004cf3f58b?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Lovlina Borgohain is a powerhouse boxer from the Golaghat district in Assam, known for her height, reach, and counterpunching expertise. Starting as a kickboxer alongside her sisters, she transitioned to amateur boxing under national scouts.",
      "During her debut in Tokyo 2020 Welterweight division, Lovlina displayed immense calm. Fighting her way with powerful hooks, she defeated seasoned boxers to win a historic bronze, making her the third Indian boxer to win an Olympic medal."
    ],
    quote: "In the ring, fear isn't an option. You must stay focused and react in micro-seconds.",
    funFact: "Lovlina is the first female athlete from Assam to win an Olympic medal, inspiring thousands of young girls in the North-East.",
    moments: [
      {
        title: "Tokyo Welterweight Quarterfinal",
        description: "Delivering a clinical counter-jab to seal her medal win.",
        image: "https://images.unsplash.com/photo-1517438476312-12d7a40ca10c?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2018", title: "World Championship Bronze", description: "Rises to elite standing with her first major world medal." },
      { year: "2021", title: "Tokyo Olympics Bronze", description: "Secures her dream podium finish in Tokyo." },
      { year: "2023", title: "World Championship Gold", description: "Claims elite flyweight gold in New Delhi." }
    ]
  },
  {
    id: "leander-paes",
    name: "Leander Paes",
    sport: "Tennis (Men's Singles)",
    medals: [
      { year: "Atlanta 1996", type: "bronze", detail: "Historic individual bronze in tennis singles" }
    ],
    avatar: "🎾",
    category: "Tennis",
    bio: "Tennis icon who gave India its first individual Olympic medal in 44 years with a legendary fighting display.",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Leander Paes is a tennis legend and one of the finest double-specialists in world tennis history. In individual singles, his athletic display, raw hustle, and volleying reflexes are the stuff of legend.",
      "At the Atlanta 1996 Olympics, Leander competed with a wild card. Fighting through severe wrist soreness and defeating top seeds, he delivered India's first individual Olympic medal in 44 years with a glorious bronze medal sweep."
    ],
    quote: "When you represent India, you play with the passion of over a billion hearts.",
    funFact: "Leander is born into an exceptionally athletic family: his father was a bronze medalist in the 1972 Olympic field hockey team, and his mother captained the national basketball team.",
    moments: [
      {
        title: "Atlanta Bronze Ace",
        description: "Fierce serving victory over Fernando Meligeni to clinch bronze.",
        image: "https://images.unsplash.com/photo-1622279457486-62dcc4a4b1fa?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "1996", title: "Atlanta Olympics Bronze", description: "Historic individual tennis medal breaking a 44-year barren run." },
      { year: "1999", title: "World No. 1 Doubles", description: "First Indian to reach the absolute summit of international doubles tennis rankings." },
      { year: "1999-2016", title: "18 Grand Slam Titles", description: "Unmatched championship titles in mens doubles and mixed doubles." }
    ]
  },
  {
    id: "karnam-malleswari",
    name: "Karnam Malleswari",
    sport: "Weightlifting (69kg Category)",
    medals: [
      { year: "Sydney 2000", type: "bronze", detail: "First Indian woman to win an Olympic medal" }
    ],
    avatar: "🏋️‍♀️",
    category: "Weightlifting",
    bio: "Pioneered a historic path for female athletes in India by lifting 240kg total to secure her bronze medal.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Karnam Malleswari is an absolute pioneer of Indian women's sports, who blazed a spectacular trail. Coming from a village in Andhra Pradesh, she overcame severe social criticisms to train in heavy powerlifting.",
      "At the Sydney 2000 Olympic Games, Karnam became the first Indian woman to win an Olympic medal. Lifting a heavy total of 240kg (110kg Snatch and 130kg Clean & Jerk) in the 69kg category, she claimed Bronze."
    ],
    quote: "I wanted to prove that girls in India could be strong enough to lift the heaviest weights in the world.",
    funFact: "Often referred to as the 'Iron Lady', Karnam's historic achievement in Sydney completely shifted national perception and funding towards female sports in India.",
    moments: [
      {
        title: "Sydney Core Triumph",
        description: "Lifting 130kg in Clean & Jerk, holding it high to secure the podium.",
        image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "1994", title: "World Championship Gold", description: "Wins historic weightlifting golds in Istanbul." },
      { year: "1995", title: "Khel Ratna Award", description: "Awarded India's highest sporting honor." },
      { year: "2000", title: "Sydney Olympics Bronze", description: "First Indian female Olympian on the podium." }
    ]
  },
  {
    id: "sakshi-malik",
    name: "Sakshi Malik",
    sport: "Wrestling (58kg Category)",
    medals: [
      { year: "Rio 2016", type: "bronze", detail: "Dramatic final-second wrestling comeback" }
    ],
    avatar: "🤼‍♀️",
    category: "Wrestling",
    bio: "The first Indian female wrestler to stand on an Olympic podium, winning a thriller bronze medal match in Rio.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Sakshi Malik is a freestyle wrestler from Mokhra village in Rohtak, Haryana, who broke glass ceilings in Indian wrestling.",
      "At Rio 2016, Sakshi entered the bronze final. With only 10 seconds remaining on the clock and trailing 5-7, she executed a spectacular hip-lock move to pin her rival, winning 8-5 to become the first Indian female wrestler to win an Olympic medal."
    ],
    quote: "Wrestling is about those final seconds. If you don't give up, anything is possible.",
    funFact: "To achieve her success, Sakshi trained beside boys in local akharas, defying local village elders who initially opposed women doing wrestling.",
    moments: [
      {
        title: "Epic Rio Comeback",
        description: "Executed a breathtaking take-down in the last 10 seconds of the match.",
        image: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2014", title: "Commonwealth Games Silver", description: "Brilliant performance in Glasgow." },
      { year: "2016", title: "Rio Olympics Bronze", description: "First Indian female wrestler to claim an Olympic medal." },
      { year: "2022", title: "Commonwealth Games Gold", description: "Claims the top prize in Birmingham with beautiful fights." }
    ]
  },
  {
    id: "rajyavardhan-rathore",
    name: "Rajyavardhan Singh Rathore",
    sport: "Shooting (Double Trap)",
    medals: [
      { year: "Athens 2004", type: "silver", detail: "India's first individual post-1900 Olympic silver" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "First individual silver medalist for independent India, paving the way for the nation's elite shooting revolution.",
    image: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Colonel Rajyavardhan Singh Rathore created historic waves at the Athens 2004 Games. A career army officer, his discipline, laser-like focus, and incredible reaction speeds redefined Indian sports.",
      "In the Men's Double Trap shooting competition, he shot a brilliant score of 179 out of 200 targets to claim a breathtaking Silver medal. It was India's first individual Olympic silver medal since independence.",
      "His landmark silver was the catalyst that proved Indian athletes could compete and conquer at the grandest Olympic stages, setting off a golden era for Indian shooting."
    ],
    quote: "Success is not a destination, it is the spirit of tireless journey and extreme focus under high fire.",
    funFact: "Rathore is a highly decorated army officer who served in the Indian Army's elite Grenadiers regiment before dedicating himself completely to shooting sports.",
    moments: [
      {
        title: "Athens 2004 Milestone",
        description: "Holding the Indian flag high with pride on the Olympic podium with the historic silver.",
        image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2004", title: "Athens Olympic Silver", description: "Wins India's first individual post-independence silver medal in Double Trap." },
      { year: "2006", title: "Commonwealth & Asian Glory", description: "Kicks off multiple Gold sweeps across Commonwealth and Asian games." }
    ]
  },
  {
    id: "vijay-kumar",
    name: "Vijay Kumar",
    sport: "Shooting (25m Rapid Fire Pistol)",
    medals: [
      { year: "London 2012", type: "silver", detail: "25m Rapid Fire Pistol silver finish" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "A cool and calculated marksman who delivered a stunning silver medal under intense heat in London 2012.",
    image: "https://images.unsplash.com/photo-1504221507732-5246c045949b?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Subedar Major Vijay Kumar, hailing from Himachal Pradesh, is an Indian shooter from the army's elite Dogra Regiment who holds an extraordinary record of calm precision.",
      "In London 2012, while the nation had its eyes on other high-profile shootists, Vijay delivered standard excellence in the 25m Rapid Fire Pistol. In a grueling final against world-class targets, he maintained a steady pulse, hitting 30 scores to win the Silver medal.",
      "Known for his quiet demeanor, Vijay Kumar remains one of the most underrated yet clinical Olympic heroes of Indian sports history."
    ],
    quote: "When you are on the range, the crowd's noise disappears. It is just your pulse, your sight, and the trigger.",
    funFact: "Vijay was awarded the honorary rank of Lieutenant in the Indian Army in recognition of his outstanding achievements at the Olympic Games.",
    moments: [
      {
        title: "London 2012 Rapid Fire Clash",
        description: "An epic target-bursting final round that sealed India's glorious silver medal.",
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2010", title: "Commonwealth Games Haul", description: "Clinches three gold medals and one silver at Delhi Commonwealth Games." },
      { year: "2012", title: "London Olympics Silver", description: "Scores a magnificent second-place podium finish in 25m Rapid Fire Pistol." }
    ]
  },
  {
    id: "kd-jadhav",
    name: "Kashaba Dadasaheb Jadhav",
    sport: "Wrestling (Men's Bantamweight)",
    medals: [
      { year: "Helsinki 1952", type: "bronze", detail: "Men's Bantamweight Freestyle 1952" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "The legendary pioneer who won the first ever individual Olympic medal for independent India at Helsinki 1952.",
    image: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Kashaba Dadasaheb Jadhav, fondly known as 'Pocket Dynamo', was an extraordinary wrestling prodigy from Maharashtra who carved independent India's name on the Olympic podium.",
      "At the Helsinki 1952 Games, battling lack of funds and unfamiliar mat mats (having trained mostly in dirt akharas), he displayed pure tactical mastery in the flyweight/bantamweight wrestling division.",
      "His historic bronze medal was the absolute first individual medal for free India and inspired generations of indigenous wrestlers to aim for absolute global glory."
    ],
    quote: "He who has grease on his body and mud on his heart can conquer any mat on the planet.",
    funFact: "To fund his Olympic travel to Helsinki, Jadhav's college principal mortgaged his own home, and local villagers in Goleshwar contributed whatever tiny amounts they could save.",
    moments: [
      {
        title: "Helsinki 1952 Breakthrough",
        description: "Beating seasoned wrestlers with lightning-fast leg-trips and pure grit to clinch bronze.",
        image: "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "1948", title: "London Debut", description: "First Olympic appearance, finishing a respectworthy 6th on the world stage." },
      { year: "1952", title: "Helsinki Bronze Medal", description: "Wins India's first individual Olympic medal post-independence." }
    ]
  },
  {
    id: "vijender-singh",
    name: "Vijender Singh",
    sport: "Boxing (Middleweight)",
    medals: [
      { year: "Beijing 2008", type: "bronze", detail: "India's first Olympic boxing medal in history" }
    ],
    avatar: "🥊",
    category: "Boxing",
    bio: "The sensational middleweight boxer who triggered India's modern boxing revolution by winning bronze at Beijing 2008.",
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Vijender Singh, hailing from Kaluwas in Haryana, brought swagger, power, and high popularity to Indian amateur boxing.",
      "At Beijing 2008, competing in the 75kg middleweight category, his devastating hooks and ironclad guard drove him straight into the semi-finals, securing a historic first-ever boxing bronze medal for India.",
      "His victory transformed Bhiwani into India's 'Little Cuba' and propelled ringside sports into mainstream prime-time television national attention."
    ],
    quote: "A single blow in the ring can change your life. You just need to keep your eyes open and strike when they drop guard.",
    funFact: "Vijender initially took up boxing seriously to follow his elder brother's footsteps and ultimately support his family financially.",
    moments: [
      {
        title: "Beijing 2008 Medal Round",
        description: "Defeating Carlos Góngora of Ecuador 9-4 in the quarter-final to guarantee India's first boxing medal.",
        image: "https://images.unsplash.com/photo-1509563268479-0f004cf3f58b?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2006", title: "Melbourne Silver", description: "Wins silver at the Commonwealth Games, announcing his arrival globally." },
      { year: "2008", title: "Beijing Bronze Medal", description: "Becomes the first Indian boxer to win an Olympic medal." },
      { year: "2009", title: "World No. 1 Ranking", description: "Reaches the absolute top rank in the international middleweight boxing standings." }
    ]
  },
  {
    id: "gagan-narang",
    name: "Gagan Narang",
    sport: "Shooting (10m Air Rifle)",
    medals: [
      { year: "London 2012", type: "bronze", detail: "10m Air Rifle bronze with high-pressure score" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "Precision marksman who shot an outstanding bronze medal at the London 2012 Olympic Games.",
    image: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Gagan Narang is a stellar rifle shooter who proved his mettle by rising under colossal expectations in Shooting venues.",
      "In the London 2012 Games, Gagan qualified for the 10m Air Rifle final with extreme focus. Under deafening applause, he Shot a score of 701.1 to seize a well-deserved Bronze medal.",
      "Narang's consistency and calm breathing under the heaviest tournament fire cemented shooting as India's premier individual sport."
    ],
    quote: "You don't think about the target; you think about your breath, your trigger release, and the circle of light.",
    funFact: "At the 2010 Commonwealth Games, Gagan had a flawless campaign, winning 4 Gold Medals and setting a new world record score of 703.6.",
    moments: [
      {
        title: "London 2012 Shoot-out",
        description: "Hitting the bullseye on consecutive high-pressure final shots to finish third in matching standard.",
        image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2006", title: "World Cup Gold", description: "Secures first place in Guangzhou World Cup with excellent shooting." },
      { year: "2010", title: "Commonwealth Clean Sweep", description: "Wins 4 Gold medals at the Commonwealth Games in Delhi." },
      { year: "2012", title: "London Olympic Bronze", description: "Brings home the bronze medal in the Men's 10m Air Rifle event." }
    ]
  },
  {
    id: "yogeshwar-dutt",
    name: "Yogeshwar Dutt",
    sport: "Wrestling (Men's 60kg Freestyle)",
    medals: [
      { year: "London 2012", type: "bronze", detail: "Men's 60kg freestyle bronze in intense repechage" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "The legendary warrior wrestler who overcame multiple knee injuries to pull off three historic victories in less than an hour for London 2012 bronze.",
    image: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Yogeshwar Dutt, from Haryana's Sonipat, represents untamed spirit and absolute grit. His wrestling career was plagued by career-threatening knee injuries, but his loyalty to the sport remained supreme.",
      "At the London 2012 Olympics, after a devastating initial defeat, he entered the repechage stage. With the clock ticking and displaying superhuman leg-tackles, Yogeshwar won three consecutive high-density matches in less than an hour to claim a heroic Bronze medal."
    ],
    quote: "Hard work beats all talent if talent does not wrestle with absolute fire every single hour on the dirt.",
    funFact: "Yogeshwar's signature move was the 'Phirni' (a high-intensity leg-lock rotatory twist) which he used to pin down several world-class opponents in the London repechage round.",
    moments: [
      {
        title: "The Magic 'Phirni' Move",
        description: "Executing his trademark leg-lock spin to turn his opponent over and seal the bronze medal in London.",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2006", title: "Doha Asian Bronze", description: "Wins a bronze medal at the Asian Games despite losing his father just days before departure." },
      { year: "2010", title: "Commonwealth Gold", description: "Clinches a stellar gold at his home games in New Delhi." },
      { year: "2012", title: "London Olympic Bronze", description: "Achieves ultimate glory with his relentless repechage runs on London mats." }
    ]
  },
  {
    id: "bajrang-punia",
    name: "Bajrang Punia",
    sport: "Wrestling (Men's 65kg Freestyle)",
    medals: [
      { year: "Tokyo 2020", type: "bronze", detail: "Dominant 8-0 victory in the medal match" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "Powerhouse grappler who shut out his opponent 8-0 in the Tokyo 2020 medal match to stand on the podium.",
    image: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Bajrang Punia of Khudan, Haryana, is widely regarded as one of India's most powerful, relentless, and physically imposing freestyle wrestlers.",
      "At Tokyo 2020, competing under high-pressure expectations and carrying a knee-injury bandage, Bajrang fought passionately. In the Bronze medal clash, he completely dominated Daulet Niyazbekov with an undisputed 8-0 scoreline to win the bronze."
    ],
    quote: "Wrestling is not a sport of anger; it is the absolute celebration of relentless physical craft, strategy, and pure stamina.",
    funFact: "As a young kid, Bajrang's favorite play activity was wrestling in the muddy fields of his village; he skipped school classes just to watch local village dangals.",
    moments: [
      {
        title: "Tokyo 2020 Shutout",
        description: "A commanding and flawless performance to win the bronze medal 8-0.",
        image: "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2018", title: "Asian Games Gold", description: "Stands on top of the podium in Jakarta in the 65kg freestyle class." },
      { year: "2019", title: "World silver", description: "Wins a silver medal in Nur-Sultan World Wrestling Championships." },
      { year: "2021", title: "Tokyo Olympics Bronze", description: "Clenches the coveted bronze medal despite carrying a recurring knee issue." }
    ]
  },
  {
    id: "swapnil-kusale",
    name: "Swapnil Kusale",
    sport: "Shooting (50m Rifle 3 Positions)",
    medals: [
      { year: "Paris 2024", type: "bronze", detail: "Men's 50m Rifle 3 Positions bronze" }
    ],
    avatar: "🎯",
    category: "Shooting",
    bio: "Cool-headed marksman who delivered a historic bronze medal in the grueling 50m Rifle 3 Positions event at Paris 2024.",
    image: "https://images.unsplash.com/photo-1504221507732-5246c045949b?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Swapnil Kusale, born in Kolhapur, Maharashtra, wrote a stunning chapter in Indian shooting sports history during the Paris 2024 Olympics.",
      "In the highly technical and grueling 50m Rifle 3 Positions (Kneeling, Prone, and Standing), which tests endurance over hours, Swapnil maintained standard composure. He scored a stellar 451.4 in the high-stakes final to land third and secure the Bronze medal.",
      "He became the first ever Indian shooter to qualify for and win an Olympic medal in the Men's 50m Rifle 3 Positions category."
    ],
    quote: "In the 3 Positions event, you need to be versatile, calm, and adapt your muscle memory to three completely different shooting postures.",
    funFact: "Swapnil works as a ticket collector for the Indian Railways and got inspired to shoot precisely after watching legendary sports profiles.",
    moments: [
      {
        title: "Paris 2024 Standing Shoot",
        description: "Delivering a clutch series of high-precision standing shots to secure his dream podium finish.",
        image: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2015", title: "National Junior Champion", description: "Wins first major national title, establishing his shooting base." },
      { year: "2023", title: "Baku World Cup Gold", description: "Claims mixed team gold at the ISSF World Cup." },
      { year: "2024", title: "Paris Olympics Bronze", description: "Achieves historic first-ever bronze for India in 50m Rifle 3 Positions." }
    ]
  },
  {
    id: "aman-sehrawat",
    name: "Aman Sehrawat",
    sport: "Wrestling (Men's 57kg Freestyle)",
    medals: [
      { year: "Paris 2024", type: "bronze", detail: "India's youngest individual Olympic medalist" }
    ],
    avatar: "🤼‍♂️",
    category: "Wrestling",
    bio: "Determined youngster who became the youngest individual Olympic medalist in Indian history by winning bronze at Paris 2024.",
    image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop",
    longDetails: [
      "Aman Sehrawat, born in Birohar, Haryana, is a wrestling sensation who conquered massive personal tragedies to write his name in Olympic folklore.",
      "Orphaned at a tender age of 11, Aman found refuge and purpose in Delhi's legendary Chhatrasal Stadium. At just 21 years of age, he represented India at the Paris 2024 Games.",
      "Displaying aggressive hand-fights and explosive pace, Aman defeated Puerto Rico's Darian Cruz 13-5 in a thrilling high-scoring bout to win the Bronze, becoming the youngest individual Olympic medalist from India in history."
    ],
    quote: "When you have nothing to lose, you bring your absolute best to the mat. I wrestled for my parents and my nation.",
    funFact: "Aman slept on a simple wooden cot in a shared akhara room for years and adheres strictly to a disciplined wrestler lifestyle of zero distractions.",
    moments: [
      {
        title: "Paris 2024 Bronze Bout",
        description: "Securing a massive point-lead with aggressive takedowns in the second half of the bronze medal match.",
        image: "https://images.unsplash.com/photo-1599586120429-48281b6f0ece?q=80&w=600&auto=format&fit=crop"
      }
    ],
    timeline: [
      { year: "2022", title: "World U23 Champion", description: "Wins gold in Pontevedra, becoming India's first-ever Under-23 World Wrestling Champion." },
      { year: "2023", title: "Asian Champion Gold", description: "Claims gold at the Asian Championships in Astana." },
      { year: "2024", title: "Paris Olympic Bronze", description: "Makes history at 21 as India's youngest individual medalist." }
    ]
  }
];

// Trivia datasets
const TRIVIA_QUESTIONS = [
  {
    id: 1,
    question: "Which iconic athlete holds the record for the most total Olympic gold medals in history?",
    options: ["Usain Bolt", "Michael Phelps", "Larisa Latynina", "Carl Lewis"],
    answer: "Michael Phelps",
    explanation: "Michael Phelps has won a staggering 23 Olympic gold medals (28 medals overall) in swimming, representing the US."
  },
  {
    id: 2,
    question: "Where are the next Summer Olympic Games in 2028 scheduled to be held?",
    options: ["Brisbane, Australia", "Milano Cortina, Italy", "Los Angeles, United States", "Madrid, Spain"],
    answer: "Los Angeles, United States",
    explanation: "Los Angeles (LA28) will host the next Summer Olympics, while Milano Cortina hosts the Winter Olympics in 2026."
  },
  {
    id: 3,
    question: "What color represents the ring in the top left in the official Olympic Games symbol?",
    options: ["Blue", "Yellow", "Black", "Green"],
    answer: "Blue",
    explanation: "The official Olympic symbol features five interlocking rings colored Blue, Yellow, Black, Green, and Red from left to right."
  },
  {
    id: 4,
    question: "In which ancient country did the Olympic Games originate?",
    options: ["Italy", "Egypt", "Greece", "Persia"],
    answer: "Greece",
    explanation: "The ancient Olympic Games began in Greece in 776 BC and were held in Olympia in honor of Zeus."
  },
  {
    id: 5,
    question: "Who was the first Indian woman to win an individual Olympic medal?",
    options: ["PV Sindhu", "Karnam Malleswari", "Saina Nehwal", "Mary Kom"],
    answer: "Karnam Malleswari",
    explanation: "Karnam Malleswari won a historic bronze medal in weightlifting at the Sydney 2000 Olympic Games."
  },
  {
    id: 6,
    question: "Which city has hosted the Summer Olympic Games three times as of 2024?",
    options: ["Tokyo", "Athens", "Paris", "Rome"],
    answer: "Paris",
    explanation: "Paris hosted the Summer Olympics in 1900, 1924, and recently in 2024, joining London as a three-time host."
  },
  {
    id: 7,
    question: "Which breaking/street discipline made its official Summer Olympic debut in Paris 2024?",
    options: ["Skateboarding", "Parkour", "Breaking (Breakdance)", "Sport Climbing"],
    answer: "Breaking (Breakdance)",
    explanation: "Breaking (breakdance) made its official Olympic debut as a sport at Paris 2024 to engage younger audiences."
  },
  {
    id: 8,
    question: "Who won the first-ever individual gold medal for India at an Olympic Games?",
    options: ["Neeraj Chopra", "Abhinav Bindra", "Rajyavardhan Rathore", "Sushil Kumar"],
    answer: "Abhinav Bindra",
    explanation: "Abhinav Bindra made history by winning India's first individual Olympic gold medal in the 10m Air Rifle event at Beijing 2008."
  },
  {
    id: 9,
    question: "What is the official motto of the Olympic Games (translated into English)?",
    options: ["Friendship, Peace, Respect", "Faster, Higher, Stronger - Together", "Unity in Diversity", "Swifter, Stronger, Braver"],
    answer: "Faster, Higher, Stronger - Together",
    explanation: "The Olympic motto is 'Citius, Altius, Fortius - Communiter', which translates to 'Faster, Higher, Stronger - Together' in English."
  },
  {
    id: 10,
    question: "How often are the Summer Olympic Games held?",
    options: ["Every 2 Years", "Every 3 Years", "Every 4 Years", "Every 5 Years"],
    answer: "Every 4 Years",
    explanation: "Both Summer and Winter Olympic Games are held every four years, staggered by two years from each other."
  },
  {
    id: 11,
    question: "Which nation holds the record for winning the most gold medals overall in Winter Olympic history?",
    options: ["Germany", "Norway", "United States", "Canada"],
    answer: "Norway",
    explanation: "Norway dominates the Winter Olympic games, holding the record for the most winter gold medals and total winter medals."
  },
  {
    id: 12,
    question: "Which track and field legend won 4 gold medals at the 1936 Berlin Olympics?",
    options: ["Jesse Owens", "Carl Lewis", "Paavo Nurmi", "Jim Thorpe"],
    answer: "Jesse Owens",
    explanation: "Jesse Owens secured his place in history by winning four gold medals (100m, 200m, long jump, and 4x100m relay) at Berlin 1936."
  },
  {
    id: 13,
    question: "With which sport is the legendary Indian Olympian Dhyan Chand associated?",
    options: ["Wrestling", "Field Hockey", "Athletics", "Shooting"],
    answer: "Field Hockey",
    explanation: "Major Dhyan Chand is widely considered one of the greatest field hockey players ever, winning gold medals in 1928, 1932, and 1936."
  },
  {
    id: 14,
    question: "Who is the first Indian athlete to win two individual Olympic medals back-to-back?",
    options: ["PV Sindhu", "Sushil Kumar", "Neeraj Chopra", "Manu Bhaker"],
    answer: "Sushil Kumar",
    explanation: "Wrestler Sushil Kumar won bronze at Beijing 2008 and silver at London 2012, becoming the first Indian in independent history with back-to-back medals. PV Sindhu later achieved this too."
  },
  {
    id: 15,
    question: "Which track icon is known as the 'Lightning Bolt' and holds the current 100m and 200m world records?",
    options: ["Yohan Blake", "Usain Bolt", "Justin Gatlin", "Tyson Gay"],
    answer: "Usain Bolt",
    explanation: "Jamaica's Usain Bolt is the fastest human in history, establishing records of 9.58 seconds in the 100m and 19.19 seconds in the 200m at Berlin 2009."
  },
  {
    id: 16,
    question: "Which of the following high-adrenaline youth sports made its debut at Tokyo 2020?",
    options: ["Skateboarding", "Beach Volleyball", "Trampoline", "Cricket"],
    answer: "Skateboarding",
    explanation: "Skateboarding made its highly anticipated Olympic debut at the Tokyo 2020 Games, featuring Street and Park disciplines."
  },
  {
    id: 17,
    question: "What is the length of a standard Olympic-size swimming pool?",
    options: ["25 meters", "50 meters", "75 meters", "100 meters"],
    answer: "50 meters",
    explanation: "An official Olympic-size swimming pool is exactly 50 meters (164 feet) in length."
  },
  {
    id: 18,
    question: "In which athletics field event do competitors often use the 'Fosbury Flop' technique?",
    options: ["Long Jump", "Pole Vault", "High Jump", "Triple Jump"],
    answer: "High Jump",
    explanation: "The 'Fosbury Flop', introduced by Dick Fosbury, is the standard technique used by high jumpers to clear the bar backwards."
  },
  {
    id: 19,
    question: "Which country's team always leads the Parade of Nations during the opening ceremony?",
    options: ["Greece", "United States", "Host Country", "France"],
    answer: "Greece",
    explanation: "In honor of the origin of the ancient games, the delegation from Greece always enters first during the Parade of Nations."
  },
  {
    id: 20,
    question: "How long is an official Olympic marathon race?",
    options: ["30.5 kilometers", "42.195 kilometers", "50.0 kilometers", "21.097 kilometers"],
    answer: "42.195 kilometers",
    explanation: "The official marathon distance of 42.195 km (26.2 miles) was standardized at the London 1908 Olympic Games."
  }
];

export default function Olympics() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'medals' | 'overview' | 'arena' | 'trivia'>('medals');
  
  // Custom added and Firestore pooled Olympic videos
  const [customVideos, setCustomVideos] = useState<CustomOlympicVideo[]>([]);
  const [firestoreVideos, setFirestoreVideos] = useState<SportsContent[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  
  // Custom video creator input state
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDuration, setNewDuration] = useState('2:15');

  // Indian Medalists interactive filters & custom medalist list state
  const [medalists, setMedalists] = useState<IndianMedalist[]>(INDIAN_MEDALISTS);

  const [medalFilter, setMedalFilter] = useState<'all' | 'gold' | 'silver' | 'bronze'>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAthlete, setSelectedAthlete] = useState<IndianMedalist | null>(null);

  // Admin Editing Athlete state
  const [isEditingAthlete, setIsEditingAthlete] = useState(false);
  const [editAthleteName, setEditAthleteName] = useState('');
  const [editAthleteSport, setEditAthleteSport] = useState('');
  const [editAthleteCategory, setEditAthleteCategory] = useState('');
  const [editAthleteImage, setEditAthleteImage] = useState('');
  const [editAthleteAvatar, setEditAthleteAvatar] = useState('');
  const [editAthleteBio, setEditAthleteBio] = useState('');
  const [editAthleteQuote, setEditAthleteQuote] = useState('');
  const [editAthleteFunFact, setEditAthleteFunFact] = useState('');
  const [editAthleteLongDetails, setEditAthleteLongDetails] = useState('');
  const [editAthleteMoments, setEditAthleteMoments] = useState<{ title: string; description: string; image: string }[]>([]);

  // Compact list expanded state for medals
  const [expandedMedals, setExpandedMedals] = useState<Record<string, boolean>>({});

  // Trivia Quiz state
  const [triviaIdx, setTriviaIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [triviaQuestions, setTriviaQuestions] = useState<any[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<any[]>([]);

  // Time remaining count states for upcoming games
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0, hours: 0, mins: 0, secs: 0
  });

  const playerRef = useRef<HTMLVideoElement>(null);

  // Sync / Load logic
  useEffect(() => {
    // 1. Calculate time remaining to Los Angeles 2028 (Starts July 14, 2028)
    const targetDate = new Date('2028-07-14T20:00:00').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff > 0) {
        setTimeRemaining({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          secs: Math.floor((diff % (1000 * 60)) / 1000)
        });
      } else {
        setTimeRemaining({ days: 0, hours: 0, mins: 0, secs: 0 });
        clearInterval(interval);
      }
    }, 1000);

    // Set first video as default display
    setSelectedVideo({
      id: 'olympic-archery',
      title: 'Olympic Archery Individual Finals - High Precision Highlights',
      description: 'Experience the extreme concentration and precision of the Olympic individual finals match. Athletes battle millimeter by millimeter in a breathtaking final set.',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      views: 124300,
      likes: 8520
    });

    // Load quiz history attempts from localStorage
    try {
      const stored = localStorage.getItem('olympic_trivia_attempts');
      if (stored) {
        setQuizAttempts(JSON.parse(stored));
      }
    } catch (err) {
      console.warn("Could not load score history:", err);
    }

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Real-time Database Subscriptions
  useEffect(() => {
    // 1. Subscribe to Content Video collection under category 'olympics'
    const qContent = query(collection(db, 'content'), where('category', '==', 'olympics'));
    const unsubscribeContent = onSnapshot(qContent, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SportsContent));
      
      if (list.length === 0) {
        setFirestoreVideos(FALLBACK_SPORTS_CONTENT.filter(item => item.category === 'olympics'));
      } else {
        setFirestoreVideos(list);
      }
    }, (err) => {
      console.warn("Firestore Olympic category query disabled or offline:", err);
      setFirestoreVideos(FALLBACK_SPORTS_CONTENT.filter(item => item.category === 'olympics'));
      handleFirestoreError(err, OperationType.GET, 'content');
    });

    // 2. Subscribe to olympic_medalists collection
    const qMedalists = query(collection(db, 'olympic_medalists'));
    const unsubscribeMedalists = onSnapshot(qMedalists, (snapshot) => {
      if (snapshot.empty) {
        setMedalists(INDIAN_MEDALISTS);
      } else {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as IndianMedalist));

        // Merge any statically defined medalists that are not yet in Firestore (ensures instant availability)
        const existingIds = new Set(list.map(m => m.id));
        const missingDefaults = INDIAN_MEDALISTS.filter(m => !existingIds.has(m.id));
        const mergedList = [...list, ...missingDefaults];

        // Sort to match default ordering
        const orderMap = new Map(INDIAN_MEDALISTS.map((m, idx) => [m.id, idx]));
        mergedList.sort((a, b) => {
          const indexA = orderMap.get(a.id) ?? 999;
          const indexB = orderMap.get(b.id) ?? 999;
          return indexA - indexB;
        });

        setMedalists(mergedList);
      }
    }, (err) => {
      console.warn("Firestore medalists query disabled or offline:", err);
      setMedalists(INDIAN_MEDALISTS);
      handleFirestoreError(err, OperationType.GET, 'olympic_medalists');
    });

    return () => {
      unsubscribeContent();
      unsubscribeMedalists();
    };
  }, []);

  // Sync to local storage
  const saveCustomVideos = (updatedList: CustomOlympicVideo[]) => {
    setCustomVideos(updatedList);
    localStorage.setItem('custom_olympic_videos', JSON.stringify(updatedList));
  };

  // Add custom video
  const handleAddVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only administrators can add Olympic videos.');
      return;
    }
    if (!newTitle.trim() || !newUrl.trim()) {
      toast.error('Please enter a video title and URL');
      return;
    }

    // Format url to treat drive patterns or raw mp4s properly, or support standard format
    let cleanUrl = newUrl.trim();
    
    try {
      const docData = {
        title: newTitle.trim(),
        description: newDesc.trim() || 'Custom added Olympic Games highlights.',
        videoUrl: cleanUrl,
        category: 'olympics' as const,
        type: 'highlight' as const,
        status: 'ended' as const,
        isPremium: true,
        viewCount: 1,
        likes: 1,
        uniqueViewsCount: 0,
        createdAt: new Date().toISOString(),
        isCustomOlympic: true,
        duration: newDuration || '2:30'
      };

      const docRef = await addDoc(collection(db, 'content'), docData);
      
      setSelectedVideo({
        id: docRef.id,
        ...docData
      });

      // reset form
      setNewTitle('');
      setNewUrl('');
      setNewDesc('');
      setIsAddingVideo(false);
      toast.success('Olympic video added to Firestore database successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'content');
    }
  };

  // Delete custom video
  const handleDeleteVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      toast.error('Only administrators can remove Olympic videos.');
      return;
    }

    try {
      if (DEFAULT_VIDEOS.some(v => v.id === id)) {
        toast.info('Default preloaded clips are read-only.');
        return;
      }
      await deleteDoc(doc(db, 'content', id));
      toast.success('Video removed from database!');
      if (selectedVideo?.id === id) {
        setSelectedVideo(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `content/${id}`);
    }
  };

  const handleLikeVideo = async () => {
    if (!selectedVideo) return;
    toast.success('Liked! Added to recommendation algorithm.');
    
    const videoId = selectedVideo.id;
    const isDefault = DEFAULT_VIDEOS.some(v => v.id === videoId);

    if (!isDefault) {
      try {
        await updateDoc(doc(db, 'content', videoId), {
          likes: (selectedVideo.likes || 1) + 1
        });
      } catch (err) {
        console.warn("Failed to update likes in database:", err);
      }
    }
    setSelectedVideo({ ...selectedVideo, likes: (selectedVideo.likes || 0) + 1 });
  };

  // Quiz interactive click
  const handleAnswerClick = (option: string) => {
    if (selectedAnswer !== null || triviaQuestions.length === 0) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    if (option === triviaQuestions[triviaIdx].answer) {
      setQuizScore(prev => prev + 1);
      toast.success('Correct Answer! Spot on.');
    } else {
      toast.error('Incorrect! Read the explanation below.');
    }
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setShowExplanation(false);
    if (triviaIdx + 1 < triviaQuestions.length) {
      setTriviaIdx(prev => prev + 1);
    } else {
      // Quiz finished - save attempt
      const score = quizScore;
      let title = "Quiz Completed!";
      let message = "";
      let icon = "🥉";

      if (score === 5) {
        title = "Congratulations! Perfect Score!";
        message = "🥇 Perfect Gold Champion! Absolute brilliance – you know your Olympic history like a true gold medalist!";
        icon = "🥇";
      } else if (score >= 3) {
        title = "Congratulations! Great Score!";
        message = "🥈 Silver competitor! Outstanding performance – you're a true champion. Keep it up!";
        icon = "🥈";
      } else if (score >= 1) {
        title = "Congratulations on finishing!";
        message = "🥉 Bronze Athlete! Great effort – you made it onto the podium! With a bit more practice, gold is in your future.";
        icon = "🥉";
      } else {
        title = "Oops! Tough Luck!";
        message = "😢 Every champion has off days. Don't lose heart! Review the facts and try again to secure your place on the podium.";
        icon = "😢";
      }

      const attempt = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        score: score,
        total: 5,
        title: title,
        message: message,
        icon: icon
      };

      const updatedHistory = [attempt, ...quizAttempts].slice(0, 5); // Keep last 5
      setQuizAttempts(updatedHistory);
      localStorage.setItem('olympic_trivia_attempts', JSON.stringify(updatedHistory));
      setQuizFinished(true);
    }
  };

  const startNewQuiz = () => {
    const shuffled = [...TRIVIA_QUESTIONS].sort(() => 0.5 - Math.random()).slice(0, 5);
    setTriviaQuestions(shuffled);
    setTriviaIdx(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizStarted(true);
  };

  const resetQuiz = () => {
    setTriviaIdx(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizStarted(false);
  };

  const handleSaveAthlete = async () => {
    if (!isAdmin) {
      toast.error('Only administrators can edit medalist profiles.');
      return;
    }
    if (!editAthleteName.trim()) {
      toast.error('Athlete Name is required.');
      return;
    }
    if (!selectedAthlete?.id) return;

    try {
      const updatedData = {
        id: selectedAthlete.id,
        name: editAthleteName.trim(),
        sport: editAthleteSport.trim(),
        category: editAthleteCategory.trim(),
        image: editAthleteImage.trim(),
        avatar: editAthleteAvatar.trim(),
        bio: editAthleteBio.trim(),
        quote: editAthleteQuote.trim(),
        funFact: editAthleteFunFact.trim(),
        longDetails: editAthleteLongDetails.split('\n').filter(p => p.trim() !== ''),
        moments: editAthleteMoments.filter(mo => mo.title.trim() !== '')
      };

      await setDoc(doc(db, 'olympic_medalists', selectedAthlete.id), updatedData);
      
      setSelectedAthlete(prev => prev ? { ...prev, ...updatedData } : null);
      setIsEditingAthlete(false);
      toast.success('Medalist profile successfully updated in database!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update medalist in database.');
    }
  };

  // Indian Medalists filtration logic computed live on render cycles
  const filteredMedalists = medalists.filter(medalist => {
    const queryStr = searchQuery.toLowerCase().trim();
    const matchesSearch = queryStr === '' || 
      medalist.name.toLowerCase().includes(queryStr) || 
      medalist.sport.toLowerCase().includes(queryStr) || 
      medalist.category.toLowerCase().includes(queryStr) ||
      medalist.bio.toLowerCase().includes(queryStr);

    const matchesSport = sportFilter === 'all' || medalist.category === sportFilter;

    const matchesMedal = medalFilter === 'all' || medalist.medals.some(m => m.type === medalFilter);

    return matchesSearch && matchesSport && matchesMedal;
  }).sort((a, b) => {
    // Determine the highest medal color of athlete A
    const hasGoldA = a.medals.some(m => m.type === 'gold');
    const hasSilverA = a.medals.some(m => m.type === 'silver');
    const hasBronzeA = a.medals.some(m => m.type === 'bronze');
    const tierA = hasGoldA ? 1 : hasSilverA ? 2 : hasBronzeA ? 3 : 4;

    // Determine the highest medal color of athlete B
    const hasGoldB = b.medals.some(m => m.type === 'gold');
    const hasSilverB = b.medals.some(m => m.type === 'silver');
    const hasBronzeB = b.medals.some(m => m.type === 'bronze');
    const tierB = hasGoldB ? 1 : hasSilverB ? 2 : hasBronzeB ? 3 : 4;

    if (tierA !== tierB) {
      return tierA - tierB; // Gold (1) before Silver (2) before Bronze (3)
    }

    // Secondary sort: count of their highest medal tier
    const bestType = tierA === 1 ? 'gold' : tierA === 2 ? 'silver' : 'bronze';
    const countA = a.medals.filter(m => m.type === bestType).length;
    const countB = b.medals.filter(m => m.type === bestType).length;
    if (countB !== countA) {
      return countB - countA; // More medals of highest tier first
    }

    // Tertiary sort: total medals count
    if (b.medals.length !== a.medals.length) {
      return b.medals.length - a.medals.length;
    }

    // Stable sort fallback by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-bg text-text-base selection:bg-brand selection:text-white" id="olympic-main-container">
      {/* Dynamic Olympic Header Banner */}
      <div className="relative overflow-hidden bg-surface-alt border-b border-border py-16 px-4 md:px-8">
        <div className="absolute inset-0 bg-radial-gradient from-brand/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Abstract design elements & Olympic rings */}
        <div className="absolute right-8 top-8 opacity-20 hidden md:block">
          <div className="flex justify-center items-center gap-1.5">
            {/* Standard thin overlapping vectorized layout of Olympic Rings */}
            <span className="w-10 h-10 rounded-full border-2 border-blue-500 inline-block -mr-4" />
            <span className="w-10 h-10 rounded-full border-2 border-yellow-500 inline-block -mr-4 mt-6" />
            <span className="w-10 h-10 rounded-full border-2 border-slate-400 inline-block -mr-4" />
            <span className="w-10 h-10 rounded-full border-2 border-green-500 inline-block -mr-4 mt-6" />
            <span className="w-10 h-10 rounded-full border-2 border-red-500 inline-block" />
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto text-center md:text-left space-y-6">
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 px-3.5 py-1 rounded-full text-brand text-[10px] font-black uppercase tracking-widest">
            <Flame className="w-3.5 h-3.5 animate-pulse" />
            Official Games Showcase Hub
          </div>

          <h1 className="font-sans font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-tight max-w-4xl text-white">
            Olympic Games Arena
          </h1>
          <p className="text-text-muted text-sm md:text-base max-w-2xl leading-relaxed">
            Welcome to the premier destination for Olympic insights. Stream high-precision sports replays, explore historic records, watch curated highlights, and challenge your sport knowledge.
          </p>

          {/* Time Countdown Timer Component to LA 2028 */}
          <div className="p-5 md:p-6 bg-surface/40 backdrop-blur-md rounded-2xl border border-border inline-block w-full md:max-w-xl text-left">
            <div className="flex items-center gap-2 mb-3 text-text-muted text-xs font-bold uppercase tracking-widest">
              <Calendar className="w-4 h-4 text-brand" />
              Countdown to Los Angeles 2028 Summer Games
            </div>
            
            <div className="grid grid-cols-4 gap-2 md:gap-4 font-mono">
              <div className="bg-surface p-3 rounded-lg border border-border text-center">
                <span className="block text-xl md:text-2xl font-black text-white">{timeRemaining.days}</span>
                <span className="text-[9px] uppercase font-sans font-bold text-text-muted tracking-wider">Days</span>
              </div>
              <div className="bg-surface p-3 rounded-lg border border-border text-center">
                <span className="block text-xl md:text-2xl font-black text-white">{String(timeRemaining.hours).padStart(2, '0')}</span>
                <span className="text-[9px] uppercase font-sans font-bold text-text-muted tracking-wider">Hours</span>
              </div>
              <div className="bg-surface p-3 rounded-lg border border-border text-center">
                <span className="block text-xl md:text-2xl font-black text-white">{String(timeRemaining.mins).padStart(2, '0')}</span>
                <span className="text-[9px] uppercase font-sans font-bold text-text-muted tracking-wider">Mins</span>
              </div>
              <div className="bg-surface p-3 rounded-lg border border-border text-center">
                <span className="block text-xl md:text-2xl font-black text-red-500 animate-pulse">{String(timeRemaining.secs).padStart(2, '0')}</span>
                <span className="text-[9px] uppercase font-sans font-bold text-text-muted tracking-wider">Secs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="bg-surface border-b border-border sticky top-[56px] md:top-[64px] z-20">
        <div className="max-w-[1200px] mx-auto px-4 flex overflow-x-auto gap-1 sm:gap-4 py-2.5 no-scrollbar scroll-smooth">
          {(['medals', 'overview', 'arena', 'trivia'] as const).map(tab => (
            <button
              id={`tab-to-${tab}`}
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedAthlete(null);
              }}
              className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab 
                  ? 'bg-brand text-white shadow-md shadow-brand/20' 
                  : 'text-text-muted hover:text-text-base hover:bg-white/5'
              }`}
            >
              {tab === 'overview' && <BookOpen className="w-3.5 h-3.5" />}
              {tab === 'arena' && <Video className="w-3.5 h-3.5" />}
              {tab === 'medals' && <Trophy className="w-3.5 h-3.5" />}
              {tab === 'trivia' && <Sparkles className="w-3.5 h-3.5" />}
              {tab === 'medals' ? 'indian medalists' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab content container */}
      <div className="max-w-[1200px] mx-auto px-4 py-8 md:py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="tab-overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-12"
            >
              {/* Overview text block - sleek centered typography */}
              <div className="max-w-4xl mx-auto bg-surface-alt/40 p-8 md:p-10 rounded-2xl border border-border backdrop-blur-sm space-y-6">
                <div className="inline-flex items-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/25 px-3.5 py-1 rounded-full text-[10px] uppercase font-black tracking-widest">
                  <History className="w-3.5 h-3.5" />
                  Historic Legacy
                </div>
                <h2 className="font-sans font-extrabold text-3xl sm:text-4xl text-white tracking-tight leading-tight">
                  The Spirit & Flame of Global Athletics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-text-muted text-xs md:text-sm leading-relaxed">
                  <p>
                    Dating back to ancient Greece in 776 BC, the Olympic Games have transcended cultural boundaries to become the ultimate peak of physical excellence, global unity, and sportsmanship.
                  </p>
                  <p>
                    By bringing together Summer and Winter competitors from over 200 nations every four years, the Games foster an unmatched arena of athletic records and legendary stories.
                  </p>
                </div>
                <div className="p-4.5 rounded-xl bg-surface border border-border flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">Citius, Altius, Fortius - Communiter</h4>
                    <p className="text-text-muted text-xs leading-relaxed">The official Olympic motto literally translates to: "Faster, Higher, Stronger - Together".</p>
                  </div>
                </div>
              </div>

              {/* Grid of disciplines */}
              <div className="space-y-6 pt-6">
                <div>
                  <h3 className="font-sans font-bold text-xl text-white tracking-tight flex items-center gap-2">
                    <Compass className="w-5 h-5 text-brand" />
                    Core Olympic Sports Disciplines
                  </h3>
                  <p className="text-text-muted text-xs uppercase tracking-widest mt-1 font-bold">Unmatched events that demand the extreme limits of performance</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Track & Field', icon: Flame, tag: 'Athletics', desc: 'Sprints, hurdles, marathon, long jump, and shot put core track events.', color: 'from-orange-600/20 to-amber-600/10 text-orange-400 border-orange-500/25' },
                    { title: 'Aquatics Speed', icon: Trophy, tag: 'Swimming & Diving', desc: 'Incredibly intense freestyle, butterfly, medley speed tournaments, and diving arrays.', color: 'from-blue-600/20 to-cyan-600/10 text-blue-400 border-blue-500/25' },
                    { title: 'Artistic Gymnastics', icon: Award, tag: 'Gymnastics', desc: 'Peak flexibility, balance, beam, vault, and rhythmic athletic routines.', color: 'from-purple-600/20 to-pink-600/10 text-purple-400 border-purple-500/25' },
                    { title: 'Glacial Alpine', icon: Timer, tag: 'Winter Sports', desc: 'Snowboard cross, downhill ski, ice-hockey, figure skating, and curling highlights.', color: 'from-sky-600/20 to-indigo-600/10 text-sky-400 border-sky-500/25' }
                  ].map((elem, i) => {
                    const DisciplineIcon = elem.icon;
                    return (
                      <div key={i} className="bg-surface rounded-xl border border-border p-4 hover:border-brand/35 hover:bg-surface-hover/80 transition-all flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className={`w-full aspect-video rounded-lg bg-gradient-to-br ${elem.color} border flex items-center justify-center relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/30 pointer-events-none" />
                            <DisciplineIcon className="w-8 h-8 stroke-[1.5] animate-pulse" />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] uppercase font-bold tracking-widest">{elem.tag}</div>
                          </div>
                          <h4 className="font-sans text-xs font-bold text-white pt-1">{elem.title}</h4>
                          <p className="text-text-muted text-[11px] leading-relaxed">{elem.desc}</p>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-border/40">
                          <button onClick={() => setActiveTab('arena')} className="text-brand text-[10px] uppercase font-black flex items-center gap-1 hover:gap-2 transition-all">
                            Watch Clips <Play className="w-3 h-3 fill-brand/10" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'arena' && (
            <motion.div
              key="tab-arena"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Content Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-sans font-bold text-2xl text-white flex items-center gap-2">
                    <Video className="w-6 h-6 text-brand" />
                    Olympic Video Arena & User Highlights
                  </h2>
                  <p className="text-text-muted text-xs uppercase tracking-widest mt-1 font-bold">Watch replays, test custom clips, and load video streams instantly</p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    id="btn-add-custom-video"
                    onClick={() => setIsAddingVideo(!isAddingVideo)}
                    className="px-5 py-2.5 bg-brand hover:bg-brand-alt text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center justify-center gap-2 self-start"
                  >
                    <Plus className="w-4 h-4" />
                    Add Custom Olympic Video
                  </button>
                )}
              </div>

              {/* Dynamic Add Video drawer/form popup */}
              <AnimatePresence>
                {isAdmin && isAddingVideo && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleAddVideoSubmit}
                    className="p-6 bg-surface rounded-2xl border border-brand/20 space-y-4 shadow-xl overflow-hidden"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-border">
                      <h4 className="text-xs font-black uppercase tracking-widest text-brand flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Custom Olympic Video (Real-time Database Sync)
                      </h4>
                      <button type="button" onClick={() => setIsAddingVideo(false)} className="text-text-muted hover:text-white p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Video Title *</label>
                        <input
                          type="text"
                          required
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          placeholder="e.g. Swimming Finals Match 2024"
                          className="w-full bg-bg border border-white/10 p-2.5 rounded-md focus:border-brand outline-none text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Video Raw Stream URL / Embed Link *</label>
                        <input
                          type="text"
                          required
                          value={newUrl}
                          onChange={e => setNewUrl(e.target.value)}
                          placeholder="e.g. https://storage.googleapis.com/...mp4 or YouTube link"
                          className="w-full bg-bg border border-white/10 p-2.5 rounded-md focus:border-brand outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Short Description</label>
                        <input
                          type="text"
                          value={newDesc}
                          onChange={e => setNewDesc(e.target.value)}
                          placeholder="Brief information about this Olympic clip..."
                          className="w-full bg-bg border border-white/10 p-2.5 rounded-md focus:border-brand outline-none text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Clip Duration</label>
                        <input
                          type="text"
                          value={newDuration}
                          onChange={e => setNewDuration(e.target.value)}
                          placeholder="e.g., 1:45"
                          className="w-full bg-bg border border-white/10 p-2.5 rounded-md focus:border-brand outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2 bg-white text-bg hover:bg-white/90 text-xs font-black uppercase tracking-widest rounded-md"
                      >
                        Publish Clip
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Interactive Player Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Embedded dynamic media player widget */}
                <div className="lg:col-span-8 space-y-4">
                  {selectedVideo ? (
                    <div className="space-y-4">
                      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border shadow-2xl">
                        {/* Detection if it is YouTube or standard video URL */}
                        {selectedVideo.videoUrl.includes('youtube.com') || selectedVideo.videoUrl.includes('youtu.be') ? (
                          <iframe
                            className="w-full h-full absolute inset-0"
                            src={
                              selectedVideo.videoUrl.includes('embed/') 
                                ? selectedVideo.videoUrl 
                                : `https://www.youtube.com/embed/${selectedVideo.videoUrl.split('v=')[1]?.split('&')[0] || selectedVideo.videoUrl.split('/').pop()}`
                            }
                            title="Olympic Video Player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            ref={playerRef}
                            key={selectedVideo.id + selectedVideo.videoUrl}
                            src={selectedVideo.videoUrl}
                            controls
                            autoPlay={false}
                            className="w-full h-full object-contain"
                            poster={selectedVideo.thumbnailUrl || "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=800&auto=format&fit=crop"}
                          />
                        )}
                      </div>

                      {/* Video info metadata display */}
                      <div className="p-6 bg-surface rounded-2xl border border-border space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-black text-brand tracking-widest">Featured Active Video</span>
                            <h3 className="font-sans font-bold text-xl text-white">{selectedVideo.title}</h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleLikeVideo}
                              className="px-4 py-2 bg-white/5 hover:bg-brand/10 hover:text-brand border border-border hover:border-brand/30 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                            >
                              <Heart className="w-3.5 h-3.5 fill-current" />
                              Like ({selectedVideo.likes || 120})
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                toast.success('Link copied to clipboard!');
                              }}
                              className="p-2 border border-border rounded-xl hover:bg-white/5 text-text-muted hover:text-text-base transition-colors"
                              title="Share video"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <p className="text-text-muted text-xs leading-relaxed leading-loose">{selectedVideo.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-surface rounded-2xl border border-dashed border-border flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <Tv className="w-12 h-12 text-text-muted" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">No active Olympic video selected</h4>
                        <p className="text-text-muted text-xs">Add elements or pick a replay from the playlist to queue.</p>
                      </div>
                    </div>
                  )}
                </div>

                 {/* Sidebar Playlist */}
                 {(() => {
                   const allClips: any[] = [
                     ...firestoreVideos,
                     ...DEFAULT_VIDEOS.filter(dv => !firestoreVideos.some(fv => fv.videoUrl === dv.videoUrl || fv.title === dv.title))
                   ];
                   return (
                     <div className="lg:col-span-4 space-y-4 max-h-[800px] overflow-y-auto pr-1">
                       <div className="flex justify-between items-center pb-2 border-b border-border">
                         <span className="text-xs font-black uppercase tracking-widest text-text-muted">Olympic Clips Pool</span>
                         <span className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] font-mono font-bold text-white">
                           {allClips.length} Items
                         </span>
                       </div>

                       <div className="space-y-3">
                         {allClips.map((vid) => {
                           const isDefault = DEFAULT_VIDEOS.some(df => df.id === vid.id);
                           return (
                             <div
                               key={vid.id}
                               onClick={() => setSelectedVideo({
                                 id: vid.id,
                                 title: vid.title,
                                 description: vid.description,
                                 videoUrl: vid.videoUrl,
                                 thumbnailUrl: vid.thumbnailUrl,
                                 likes: vid.likes || 0
                               })}
                               className={`p-3 rounded-xl border transition-all cursor-pointer text-left flex gap-3 relative group ${
                                 selectedVideo?.id === vid.id 
                                   ? 'bg-brand/10 border-brand' 
                                   : 'bg-surface border-border hover:bg-surface-hover hover:border-white/10'
                               }`}
                             >
                               <div className="w-16 h-12 bg-black rounded overflow-hidden flex-shrink-0 relative">
                                 <img src={vid.thumbnailUrl || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=200&auto=format&fit=crop'} alt="" className="w-full h-full object-cover opacity-80" />
                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                   <Play className="w-3.5 h-3.5 text-white fill-white" />
                                 </div>
                               </div>
                               <div className="flex-grow min-w-0 space-y-1 pr-6">
                                 <span className="inline-block bg-brand/20 text-brand px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest mb-0.5">
                                   {isDefault ? 'Preloaded Clip' : 'Database Stream'}
                                 </span>
                                 <h4 className="text-xs font-bold text-white truncate">{vid.title}</h4>
                                 <p className="text-[10px] text-text-muted font-mono line-clamp-1">{vid.description}</p>
                               </div>
                               
                               {/* Allow deleting from database for Admin */}
                               {isAdmin && !isDefault && (
                                 <button
                                   onClick={async (e) => {
                                     e.stopPropagation();
                                     if (window.confirm(`Are you sure you want to delete "${vid.title}" from the database?`)) {
                                       try {
                                         await deleteDoc(doc(db, 'content', vid.id));
                                         toast.success('Video removed from database successfully!');
                                         if (selectedVideo?.id === vid.id) {
                                           setSelectedVideo(null);
                                         }
                                       } catch (err) {
                                         handleFirestoreError(err, OperationType.DELETE, `content/${vid.id}`);
                                       }
                                     }
                                   }}
                                   className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-red-500 rounded-lg bg-surface hover:bg-red-500/10 border border-border opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                   title="Delete from Database"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   );
                 })()}
              </div>
            </motion.div>
          )}

          {activeTab === 'medals' && (
            <motion.div
              key={selectedAthlete ? `athlete-${selectedAthlete.id}` : "tab-medals"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {selectedAthlete ? (
                <div className="space-y-8 animate-fadeIn" id="athlete-profile-detail-card">
                  {/* Back button and profile header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
                    <button
                      onClick={() => setSelectedAthlete(null)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border hover:border-white/20 text-xs font-bold text-white rounded-xl transition-all shadow-md group cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4 text-brand group-hover:-translate-x-1 transition-transform" />
                      Back to Medalists
                    </button>

                    <div className="flex items-center gap-3">
                      {isAdmin && !isEditingAthlete && (
                        <button 
                          onClick={() => {
                            setEditAthleteName(selectedAthlete.name);
                            setEditAthleteSport(selectedAthlete.sport);
                            setEditAthleteCategory(selectedAthlete.category);
                            setEditAthleteImage(selectedAthlete.image);
                            setEditAthleteAvatar(selectedAthlete.avatar || '🏅');
                            setEditAthleteBio(selectedAthlete.bio);
                            setEditAthleteQuote(selectedAthlete.quote || '');
                            setEditAthleteFunFact(selectedAthlete.funFact || '');
                            setEditAthleteLongDetails(selectedAthlete.longDetails.join('\n'));
                            setEditAthleteMoments(selectedAthlete.moments ? selectedAthlete.moments.map(m => ({ ...m })) : []);
                            setIsEditingAthlete(true);
                          }}
                          className="px-3.5 py-1.5 bg-brand hover:bg-brand/90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-brand/10"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Edit Profile
                        </button>
                      )}

                      <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest text-right">Share Profile</span>
                      <button 
                        onClick={() => {
                          const val = `${window.location.origin}/olympics?athlete=${selectedAthlete.id}`;
                          navigator.clipboard.writeText(val);
                          toast.success(`Copied profile link!`);
                        }}
                        className="p-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-text-muted hover:text-white transition-all cursor-pointer"
                        title="Copy profile link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isEditingAthlete ? (
                    <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6 animate-fadeIn">
                      <div className="border-b border-border pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-brand" />
                            Edit Profile: {selectedAthlete.name}
                          </h2>
                          <p className="text-text-muted text-[11px] font-bold uppercase mt-1">modify profile images, biography stories, and historic moments as an administrator</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsEditingAthlete(false)}
                            className="px-4 py-2 bg-surface hover:bg-surface-hover hover:text-white border border-border text-xs font-bold text-white rounded-xl transition-all shadow-md cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveAthlete}
                            className="px-5 py-2 bg-brand hover:bg-brand/90 text-white border border-brand/20 text-xs font-bold rounded-xl transition-all shadow-md shadow-brand/20 cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            Save Changes
                          </button>
                        </div>
                      </div>

                      {/* Core Form Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left form section */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Athlete Full Name</label>
                            <input
                              type="text"
                              value={editAthleteName}
                              onChange={(e) => setEditAthleteName(e.target.value)}
                              className="block w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold"
                              placeholder="Enter athlete name"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Sport / Event</label>
                              <input
                                type="text"
                                value={editAthleteSport}
                                onChange={(e) => setEditAthleteSport(e.target.value)}
                                className="block w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold"
                                placeholder="e.g., Boxing Men's Middleweight"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Sport Category</label>
                              <input
                                type="text"
                                value={editAthleteCategory}
                                onChange={(e) => setEditAthleteCategory(e.target.value)}
                                className="block w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold"
                                placeholder="e.g., Boxing"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            <div className="col-span-1">
                              <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Emoji</label>
                              <input
                                type="text"
                                value={editAthleteAvatar}
                                onChange={(e) => setEditAthleteAvatar(e.target.value)}
                                className="block w-full text-center px-2 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold"
                                placeholder="🥊"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Main Profile Image URL</label>
                              <input
                                type="text"
                                value={editAthleteImage}
                                onChange={(e) => setEditAthleteImage(e.target.value)}
                                className="block w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold"
                                placeholder="https://images.unsplash.com/..."
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Short Biography / Catchphrase</label>
                            <textarea
                              value={editAthleteBio}
                              onChange={(e) => setEditAthleteBio(e.target.value)}
                              className="block w-full h-24 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold resize-none"
                              placeholder="Describe legacy in 1-2 sentences"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Inspiring Quote</label>
                            <textarea
                              value={editAthleteQuote}
                              onChange={(e) => setEditAthleteQuote(e.target.value)}
                              className="block w-full h-20 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold italic resize-none"
                              placeholder="Inspirational quote of the champion"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Did You Know? Fun Fact</label>
                            <textarea
                              value={editAthleteFunFact}
                              onChange={(e) => setEditAthleteFunFact(e.target.value)}
                              className="block w-full h-20 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold resize-none"
                              placeholder="Interesting career dynamic or fact"
                            />
                          </div>
                        </div>

                        {/* Right form section */}
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase text-brand tracking-widest mb-1.5 font-sans">Full Biography Story Narrative (One Paragraph per line)</label>
                            <textarea
                              value={editAthleteLongDetails}
                              onChange={(e) => setEditAthleteLongDetails(e.target.value)}
                              className="block w-full h-44 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-white outline-none focus:border-brand/50 transition-all font-semibold leading-relaxed"
                              placeholder="Add general biography narrative blocks. Hit Enter for new paragraphs."
                            />
                          </div>

                          <div className="border border-border bg-surface-alt rounded-2xl p-4 space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-[10px] font-black uppercase text-brand tracking-widest font-sans">Manage Moments Gallery & Images</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditAthleteMoments([
                                    ...editAthleteMoments,
                                    { title: '', description: '', image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=600&auto=format&fit=crop' }
                                  ]);
                                }}
                                className="px-2.5 py-1 bg-brand/10 hover:bg-brand text-brand hover:text-white rounded-lg border border-brand/20 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all pointer-events-auto cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Moment
                              </button>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                              {editAthleteMoments.map((moment, mIdx) => (
                                <div key={mIdx} className="bg-surface p-3 rounded-xl border border-border space-y-2 relative animate-fadeIn">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditAthleteMoments(editAthleteMoments.filter((_, idx) => idx !== mIdx));
                                    }}
                                    className="absolute right-2 top-2 p-1.5 text-text-muted hover:text-red-500 rounded-md bg-surface border border-border/80 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    title="Remove Moment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <input
                                          type="text"
                                          value={moment.title}
                                          onChange={(e) => {
                                            const updated = [...editAthleteMoments];
                                            updated[mIdx].title = e.target.value;
                                            setEditAthleteMoments(updated);
                                          }}
                                          placeholder="Moment Title"
                                          className="block w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-lg text-[10px] text-white outline-none focus:border-brand/40 font-bold"
                                        />
                                      </div>
                                      <div>
                                        <input
                                          type="text"
                                          value={moment.image}
                                          onChange={(e) => {
                                            const updated = [...editAthleteMoments];
                                            updated[mIdx].image = e.target.value;
                                            setEditAthleteMoments(updated);
                                          }}
                                          placeholder="Moment Image URL"
                                          className="block w-full px-2.5 py-1.5 bg-surface-alt border border-border rounded-lg text-[10px] text-white outline-none focus:border-brand/40 font-bold"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <textarea
                                        value={moment.description}
                                        onChange={(e) => {
                                          const updated = [...editAthleteMoments];
                                          updated[mIdx].description = e.target.value;
                                          setEditAthleteMoments(updated);
                                        }}
                                        placeholder="Moment description..."
                                        className="block w-full h-12 px-2.5 py-1.5 bg-surface-alt border border-border rounded-lg text-[10px] text-white outline-none focus:border-brand/40 resize-none leading-relaxed"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {editAthleteMoments.length === 0 && (
                                <div className="text-center py-6 text-text-muted text-[11px] font-semibold">
                                  No moments. Click "Add Moment" to display key history blocks with pictures!
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button
                          type="button"
                          onClick={() => setIsEditingAthlete(false)}
                          className="px-5 py-2 bg-surface hover:bg-surface-hover hover:text-white border border-border text-xs font-bold text-white rounded-xl transition-all shadow-md cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAthlete}
                          className="px-6 py-2 bg-brand hover:bg-brand/90 text-white border border-brand/20 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-brand/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          Save Profile
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Hero Header Presentation */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-surface-alt to-surface border border-border rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
                        
                        {/* Portrait Photo */}
                        <div className="relative w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden border-2 border-border/70 flex-shrink-0 group z-10 shadow-2xl">
                          <img 
                            src={selectedAthlete.image} 
                            alt={selectedAthlete.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                          <div className="absolute bottom-3 left-3 text-2xl select-none">
                            {selectedAthlete.avatar || '🏅'}
                          </div>
                        </div>

                        <div className="space-y-4 flex-grow text-center md:text-left z-10">
                          <div className="flex flex-wrap justify-center md:justify-start gap-2.5 items-center">
                            <span className="bg-brand/10 text-brand border border-brand/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest">
                              {selectedAthlete.category}
                            </span>
                            
                            {selectedAthlete.medals.some(m => m.type === 'gold') ? (
                              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1 animate-pulse">
                                🥇 Gold Medalist
                              </span>
                            ) : selectedAthlete.medals.some(m => m.type === 'silver') ? (
                              <span className="bg-slate-300/10 text-slate-300 border border-slate-300/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                                🥈 Silver Medalist
                              </span>
                            ) : (
                              <span className="bg-amber-600/10 text-amber-500 border border-amber-600/20 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest flex items-center gap-1">
                                🥉 Bronze Medalist
                              </span>
                            )}
                          </div>

                          <div>
                            <h1 className="font-sans font-black text-3xl md:text-4xl lg:text-5xl tracking-tight text-white">{selectedAthlete.name}</h1>
                            <p className="text-brand text-xs uppercase font-extrabold tracking-widest mt-1.5">{selectedAthlete.sport}</p>
                          </div>

                          <p className="text-text-muted text-xs md:text-sm leading-relaxed max-w-2xl font-semibold">
                            {selectedAthlete.bio}
                          </p>
                        </div>
                      </div>

                      {/* Core Content Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column / Key stats, Quote, Fun Fact */}
                        <div className="space-y-6">
                          {/* Key stats panel */}
                          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white border-b border-border pb-2.5 flex items-center gap-2">
                              <Award className="w-4 h-4 text-brand" />
                              Legendary Profile Stats
                            </h3>
                            
                            <div className="space-y-4">
                              <div>
                                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Discipline</span>
                                <span className="text-xs text-white font-black">{selectedAthlete.sport}</span>
                              </div>

                              <div>
                                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Sport Category</span>
                                <span className="text-xs text-white font-black">{selectedAthlete.category}</span>
                              </div>

                              <div>
                                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Total Olympic Medals</span>
                                <div className="flex flex-col gap-1.5 mt-1.5">
                                  {selectedAthlete.medals.map((m, mIdx) => (
                                    <div key={mIdx} className="flex items-center gap-2 text-xs bg-surface-alt border border-border/60 py-1.5 px-2.5 rounded-lg font-bold">
                                      <span>{m.type === 'gold' ? '🥇' : m.type === 'silver' ? '🥈' : '🥉'}</span>
                                      <span className="uppercase text-[10px] text-white/95">{m.year}</span>
                                      <span className="text-[10px] text-text-muted truncate flex-grow text-right">{m.detail}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Inspiring quote block */}
                          {selectedAthlete.quote && (
                            <div className="bg-gradient-to-b from-surface to-surface-alt border border-border rounded-2xl p-6 relative overflow-hidden">
                              <Quote className="absolute top-4 right-4 w-12 h-12 text-brand/5 -rotate-12 pointer-events-none" />
                              <p className="text-xs leading-relaxed italic text-white relative z-10">
                                "{selectedAthlete.quote}"
                              </p>
                              <span className="block text-[9px] uppercase font-black tracking-widest text-brand mt-4 z-10 relative">
                                — {selectedAthlete.name}
                              </span>
                            </div>
                          )}

                          {/* Fun fact card */}
                          {selectedAthlete.funFact && (
                            <div className="bg-surface border border-border/80 rounded-2xl p-5 space-y-2">
                              <span className="text-[9px] uppercase font-black tracking-widest text-text-muted block">Did You Know?</span>
                              <p className="text-xs leading-relaxed text-text-muted font-semibold">
                                {selectedAthlete.funFact}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Middle & Right Content Column / Biography & Timeline */}
                        <div className="lg:col-span-2 space-y-8">
                          {/* Biography narrative */}
                          <div className="bg-surface/50 border border-border rounded-2xl p-6 md:p-8 space-y-5">
                            <h3 className="text-xs font-black uppercase tracking-wider text-white border-b border-border pb-3 flex items-center gap-2">
                              <History className="w-4.5 h-4.5 text-yellow-500" />
                              The Journey: Raising the Tiranga
                            </h3>
                            
                            <div className="space-y-4">
                              {selectedAthlete.longDetails.map((paragraph, pIdx) => (
                                <p key={pIdx} className="text-text-muted text-xs md:text-sm leading-relaxed font-semibold">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </div>

                          {/* Moments Gallery */}
                          <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted block">
                              Historic Olympic Moments
                            </h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {selectedAthlete.moments.map((m, mIdx) => (
                                <div key={mIdx} className="bg-surface border border-border rounded-xl overflow-hidden group shadow-lg">
                                  <div className="relative aspect-video w-full bg-black overflow-hidden select-none">
                                    <img 
                                      src={m.image} 
                                      alt={m.title} 
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 animate-fadeIn"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                                  </div>
                                  <div className="p-4 space-y-1.5">
                                    <h4 className="text-xs font-extrabold text-white">{m.title}</h4>
                                    <p className="text-[10px] text-text-muted font-semibold leading-relaxed">{m.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Timeline points */}
                          {selectedAthlete.timeline && (
                            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6">
                              <h3 className="text-xs font-black uppercase tracking-wider text-white border-b border-border pb-3 flex items-center gap-2">
                                <Sparkles className="w-4.5 h-4.5 text-brand" />
                                Accolades & Career Timeline
                              </h3>
                              
                              <div className="relative border-l border-border pl-6 ml-3 space-y-6">
                                {selectedAthlete.timeline.map((item, tIdx) => (
                                  <div key={tIdx} className="relative group">
                                    {/* Dot */}
                                    <div className="absolute -left-[31px] top-1 bg-surface border-2 border-brand w-3.5 h-3.5 rounded-full z-10 transition-colors group-hover:bg-brand" />
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-black text-brand uppercase tracking-wider bg-brand/10 border border-brand/25 px-2 py-0.5 rounded-full">{item.year}</span>
                                      <h4 className="text-xs font-extrabold text-white mt-1.5">{item.title}</h4>
                                      <p className="text-[10px] text-text-muted font-medium">{item.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div>
                      <h2 className="font-sans font-bold text-2xl text-white flex items-center gap-2 animate-pulse">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        Indian Olympic Medalists
                      </h2>
                      <p className="text-text-muted text-xs uppercase tracking-widest mt-1 font-bold">Celebrating India's legends and history-makers at the Olympic Games</p>
                    </div>

                    {/* Quick Medal Summary / Counts */}
                    <div className="flex gap-3 text-[11px] bg-surface-alt border border-border px-4 py-2 rounded-xl">
                      <div className="flex items-center gap-1.5 px-1.5">
                        <span className="text-base">🥇</span>
                        <span className="font-bold text-white">
                          {medalists.reduce((sum, m) => sum + m.medals.filter(med => med.type === 'gold').length, 0)} Gold
                        </span>
                      </div>
                      <div className="w-[1px] h-4 bg-border/60 self-center" />
                      <div className="flex items-center gap-1.5 px-1.5">
                        <span className="text-base">🥈</span>
                        <span className="font-bold text-white">
                          {medalists.reduce((sum, m) => sum + m.medals.filter(med => med.type === 'silver').length, 0)} Silver
                        </span>
                      </div>
                      <div className="w-[1px] h-4 bg-border/60 self-center" />
                      <div className="flex items-center gap-1.5 px-1.5">
                        <span className="text-base">🥉</span>
                        <span className="font-bold text-white">
                          {medalists.reduce((sum, m) => sum + m.medals.filter(med => med.type === 'bronze').length, 0)} Bronze
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Search & Filtering controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Search query input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-text-muted" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search by Name, Sport..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-xs placeholder:text-text-muted text-white outline-none focus:border-brand/45 transition-all font-semibold"
                      />
                      {searchQuery !== '' && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Filter by Sport category */}
                    <div className="relative">
                      <select
                        value={sportFilter}
                        onChange={(e) => setSportFilter(e.target.value)}
                        className="block w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-xs text-white appearance-none outline-none focus:border-brand/45 transition-all font-bold uppercase tracking-wider"
                      >
                        <option value="all">🥋 All Core Sports</option>
                        {Array.from(new Set(medalists.map(m => m.category))).map(cat => (
                          <option key={cat} value={cat}>🏅 {cat}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <Compass className="h-3.5 w-3.5 text-text-muted" />
                      </div>
                    </div>

                    {/* Filter by Medal Color tier */}
                    <div className="relative">
                      <div className="flex bg-surface border border-border p-1 rounded-xl w-full h-[38px] items-center">
                        {(['all', 'gold', 'silver', 'bronze'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setMedalFilter(type)}
                            className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              medalFilter === type 
                                ? 'bg-brand text-white shadow' 
                                : 'text-text-muted hover:text-white'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Grid block displaying filtered Indian Medalists */}
                  {filteredMedalists.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">
                      {filteredMedalists.map((athlete, idx) => (
                        <motion.div
                          key={idx}
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => setSelectedAthlete(athlete)}
                          className="bg-surface rounded-2xl border border-border p-5 flex flex-col justify-between hover:border-brand/50 hover:bg-surface-hover/80 hover:shadow-brand/5 cursor-pointer transition-all shadow-xl hover:shadow-brand/2 relative overflow-hidden group"
                        >
                          <div className="space-y-4">
                            {/* Athlete header info */}
                            <div className="flex items-start gap-4">
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border bg-surface-alt flex-shrink-0 z-10 group-hover:scale-105 transition-all flex items-center justify-center">
                                {athlete.image ? (
                                  <>
                                    <img 
                                      src={athlete.image} 
                                      alt={athlete.name} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="absolute bottom-1 right-1 text-xs select-none">
                                      {athlete.avatar || '🏅'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-3xl select-none">{athlete.avatar || '🏅'}</span>
                                )}
                              </div>
                              <div>
                                <span className="bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-widest inline-block mb-1.5">
                                  {athlete.category}
                                </span>
                                <h3 className="text-sm font-bold text-white tracking-tight">{athlete.name}</h3>
                                <p className="text-text-muted text-[10px] uppercase font-bold mt-0.5">{athlete.sport}</p>
                              </div>
                            </div>

                            {/* Athlete brief biography */}
                            <p className="text-text-muted text-xs leading-relaxed font-semibold pr-3 pt-1">
                              {athlete.bio}
                            </p>
                          </div>

                          {/* Full Story interactive badge */}
                          <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider text-brand opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-brand/5 px-2.5 py-1 rounded-full border border-brand/10">
                            Full Story & Moments
                            <ExternalLink className="w-2.5 h-2.5" />
                          </div>

                          {/* Displaying detailed medals list for each athlete */}
                          <div className="mt-5 pt-4 border-t border-border/50 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black uppercase tracking-widest text-text-muted block">Podium Finishes</span>
                              {athlete.medals.length > 3 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Stop opening athlete modal/profile view
                                    setExpandedMedals(prev => ({ ...prev, [athlete.id]: !prev[athlete.id] }));
                                  }}
                                  className="text-[9px] font-black uppercase tracking-widest text-brand hover:text-brand/80 cursor-pointer bg-brand/5 hover:bg-brand/10 px-2 py-0.5 rounded border border-brand/10 transition-colors"
                                >
                                  {expandedMedals[athlete.id] ? "Show Less" : `+ ${athlete.medals.length - 3} More`}
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(expandedMedals[athlete.id] ? athlete.medals : athlete.medals.slice(0, 3)).map((m, mIdx) => (
                                <div 
                                  key={mIdx} 
                                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[10px] font-bold ${
                                    m.type === 'gold' 
                                      ? 'bg-yellow-500/5 text-yellow-500 border-yellow-500/20' 
                                      : m.type === 'silver' 
                                        ? 'bg-slate-300/5 text-slate-300 border-slate-300/20' 
                                        : 'bg-amber-600/5 text-amber-500 border-amber-600/20'
                                  }`}
                                  title={m.detail}
                                >
                                  <span>{m.type === 'gold' ? '🥇' : m.type === 'silver' ? '🥈' : '🥉'}</span>
                                  <span className="uppercase tracking-wide">{m.year}</span>
                                  <span className="opacity-50 font-normal">|</span>
                                  <span className="text-[9px] text-white/80 font-medium truncate max-w-[150px]">{m.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-surface rounded-2xl border border-border space-y-3">
                      <div className="text-4xl text-text-muted animate-pulse">🎯</div>
                      <h3 className="font-sans font-bold text-lg text-white">No Indian Medalists Found</h3>
                      <p className="text-text-muted text-xs">Try adjusting your filters or search input query words.</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'trivia' && (
            <motion.div
              key="tab-trivia"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div>
                <h2 className="font-sans font-bold text-2xl text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-brand" />
                  Olympic Games Trivia Challenge
                </h2>
                <p className="text-text-muted text-xs uppercase tracking-widest mt-1 font-bold">Challenge your peak sports intelligence & trivia facts expertise</p>
              </div>

              {!quizStarted ? (
                <div className="bg-surface rounded-2xl border border-border p-6 md:p-8 space-y-6 shadow-2xl">
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-3 rounded-full bg-brand/10 border border-brand/20 text-brand">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <h3 className="font-sans font-bold text-xl text-white">Olympic Trivia Center</h3>
                    <p className="text-text-muted text-xs leading-relaxed max-w-md mx-auto">
                      Test your sports intelligence across 5 randomly selected questions. Answer correctly of 5, get unique questions and no repetition in the current round!
                    </p>
                  </div>

                  {quizAttempts.length > 0 ? (
                    <div className="space-y-4">
                      {/* Best attempt / stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface-alt border border-border rounded-xl p-4 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block">High Score</span>
                          <span className="text-2xl font-black text-brand block mt-1">
                            {Math.max(...quizAttempts.map(a => a.score))} / 5
                          </span>
                          <span className="text-[9px] font-semibold text-white/50 block mt-0.5 uppercase tracking-wide">🏆 Best Podium Run</span>
                        </div>
                        <div className="bg-surface-alt border border-border rounded-xl p-4 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted block">Last Attempt</span>
                          <span className="text-2xl font-black text-white block mt-1">
                            {quizAttempts[0].score} / 5
                          </span>
                          <span className="text-[9px] font-semibold text-text-muted block mt-0.5 truncate uppercase tracking-widest">{quizAttempts[0].date}</span>
                        </div>
                      </div>

                      {/* Last attempt review card */}
                      <div className="p-4 rounded-xl border border-border bg-brand/5 space-y-1.5 text-left">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-white">
                          <span>{quizAttempts[0].icon}</span>
                          <span>{quizAttempts[0].title || "Your Last Result"}</span>
                        </div>
                        <p className="text-text-not-so-muted text-xs leading-relaxed">{quizAttempts[0].message}</p>
                      </div>

                      {/* Attempts History */}
                      <div className="space-y-2 text-left">
                        <h4 className="text-[10px] uppercase font-black tracking-widest text-text-muted flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-brand" /> Recent Attempts History
                        </h4>
                        <div className="divide-y divide-border/50 border border-border/50 rounded-xl overflow-hidden bg-surface-alt">
                          {quizAttempts.map((attempt, idx) => (
                            <div key={attempt.id || idx} className="p-3 flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base select-none">{attempt.icon}</span>
                                <div>
                                  <span className="font-bold text-white block">Score: {attempt.score} / {attempt.total}</span>
                                  <span className="text-[9px] text-text-muted">{attempt.date}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-black uppercase text-brand/80 px-2.5 py-1 bg-brand/5 rounded-full border border-brand/10">
                                {attempt.score === 5 ? 'Gold Medal' : attempt.score >= 3 ? 'Silver' : attempt.score >= 1 ? 'Bronze' : 'Oops'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-surface-alt border border-border rounded-xl space-y-2">
                      <p className="text-xs text-text-muted font-normal">No history found. Ready to make your first podium run?</p>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand">🥇 5/5 gets Gold Medal status!</div>
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <button
                      onClick={startNewQuiz}
                      className="w-full py-3.5 bg-brand hover:bg-brand/90 hover:scale-[1.01] text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      {quizAttempts.length > 0 ? "Retry Olympic Challenge" : "Start Quiz Challenge"}
                    </button>
                  </div>
                </div>
              ) : !quizFinished ? (
                <div className="bg-surface rounded-2xl border border-border p-6 md:p-8 space-y-6 shadow-2xl text-left">
                  {/* Progress tracker */}
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-text-muted">
                    <span>Question {triviaIdx + 1} of {triviaQuestions.length}</span>
                    <span>Score: {quizScore}</span>
                  </div>

                  <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand h-full transition-all duration-300" 
                      style={{ width: `${((triviaIdx) / (triviaQuestions.length || 5)) * 100}%` }}
                    />
                  </div>

                  <h3 className="font-sans text-lg md:text-xl font-bold text-white leading-snug">
                    {triviaQuestions[triviaIdx]?.question}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {triviaQuestions[triviaIdx]?.options.map((option, idx) => {
                      const isSelected = selectedAnswer === option;
                      const isCorrect = option === triviaQuestions[triviaIdx].answer;
                      let btnStyle = 'bg-surface border-border hover:border-white/20 hover:bg-white/5';
                      
                      if (selectedAnswer !== null) {
                        if (isCorrect) {
                          btnStyle = 'bg-green-500/10 border-green-500 text-green-400';
                        } else if (isSelected) {
                          btnStyle = 'bg-red-500/10 border-red-500 text-red-400';
                        } else {
                          btnStyle = 'bg-surface/30 border-border/40 opacity-50';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          id={`quiz-option-${idx}`}
                          onClick={() => handleAnswerClick(option)}
                          disabled={selectedAnswer !== null}
                          className={`w-full p-4 rounded-xl border text-left text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {selectedAnswer !== null && isCorrect && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                          {selectedAnswer !== null && isSelected && !isCorrect && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation card */}
                  {showExplanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-xl bg-surface-alt border border-border space-y-3"
                    >
                      <h4 className="text-[10px] uppercase font-black tracking-widest text-brand flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Explanation
                      </h4>
                      <p className="text-text-muted text-xs leading-loose">{triviaQuestions[triviaIdx]?.explanation}</p>
                      
                      <button
                        onClick={handleNextQuestion}
                        className="w-full mt-2 py-3 bg-white text-bg text-xs font-black uppercase tracking-widest rounded-lg hover:bg-neutral-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {triviaIdx + 1 < triviaQuestions.length ? 'Next Question' : 'Finish Quiz'}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 text-center space-y-6 shadow-2xl">
                  <div className={`inline-flex p-4 rounded-full ${quizScore === 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'} animate-bounce`}>
                    {quizScore === 0 ? <X className="w-12 h-12" /> : <Trophy className="w-12 h-12" />}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-sans font-bold text-2xl text-white">
                      {quizScore === 0 ? 'Oops! All Answers Wrong' : 'Quiz Completed Successfully!'}
                    </h3>
                    <p className="text-text-muted text-xs uppercase tracking-widest">You solved {quizScore} out of 5 answers correctly</p>
                  </div>

                  {/* Rating score badge with custom oops message rendering */}
                  <div className="p-4 bg-surface-alt border border-border rounded-xl max-w-sm mx-auto space-y-2">
                    <div className="font-black uppercase tracking-widest text-sm text-brand">
                      {quizScore === 5 ? '🥇 Perfect Gold Champion' : quizScore >= 3 ? '🥈 Silver Competitor' : quizScore >= 1 ? '🥉 Bronze Athlete' : '😢 oops'}
                    </div>
                    <p className="text-text-muted text-xs leading-relaxed">
                      {quizScore === 5 
                        ? "Perfect Gold Champion! Absolute brilliance – you know your Olympic history like a true gold medalist!" 
                        : quizScore >= 3 
                          ? "Silver competitor! Outstanding performance – you're a true champion. Keep it up!" 
                          : quizScore >= 1 
                            ? "Bronze Athlete! Great effort – you made it onto the podium! With a bit more practice, gold is in your future."
                            : "Oops! Every champion has off days. Don't lose heart! Review the facts and try again to score your first point!"}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                      onClick={startNewQuiz}
                      className="px-6 py-3 bg-brand hover:bg-brand/90 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Play Again
                    </button>
                    <button
                      onClick={resetQuiz}
                      className="px-6 py-3 bg-surface border border-border hover:bg-white/5 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Back to Scoreboard
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
