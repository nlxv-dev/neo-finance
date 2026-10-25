import type { IconName } from '@/data/iconRegistry';

// Группируем иконки по категориям для удобного поиска в UI.
// Тип IconName гарантирует, что каждая иконка есть в явном реестре.
export const ICON_GROUPS = {
  'Деньги': [
    'Wallet', 'WalletCards', 'WalletMinimal', 'Banknote', 'Coins',
    'Landmark', 'CreditCard', 'BadgeDollarSign', 'CircleDollarSign',
    'PiggyBank', 'HandCoins', 'Receipt', 'ReceiptText', 'Euro', 'PoundSterling'
  ],
  'Еда': [
    'Utensils', 'UtensilsCrossed', 'CookingPot', 'ChefHat', 'Sandwich',
    'Pizza', 'Cake', 'IceCreamBowl', 'Coffee', 'Wine', 'Beer',
    'Apple', 'Salad', 'Soup'
  ],
  'Транспорт': [
    'Car', 'Bus', 'Train', 'TramFront', 'Plane', 'Bike', 'Ship',
    'Fuel', 'ParkingMeter', 'MapPin', 'Navigation'
  ],
  'Дом': [
    'House', 'Building2', 'Bed', 'Sofa', 'Lamp', 'WashingMachine',
    'Refrigerator', 'ShowerHead', 'Bath', 'KeyRound'
  ],
  'Здоровье': [
    'HeartPulse', 'Stethoscope', 'Pill', 'Syringe', 'Hospital',
    'Cross', 'Dumbbell', 'Activity'
  ],
  'Развлечения': [
    'Gamepad2', 'Tv', 'Film', 'Clapperboard', 'Music', 'Headphones',
    'Radio', 'Camera', 'Ticket', 'PartyPopper'
  ],
  'Работа': [
    'Briefcase', 'Laptop', 'Monitor', 'Smartphone', 'Printer',
    'FileText', 'Presentation', 'Clipboard', 'Calculator'
  ],
  'Покупки': [
    'ShoppingCart', 'ShoppingBag', 'Store', 'Gift', 'Shirt',
    'Footprints', 'Glasses', 'Watch'
  ],
  'Образование': [
    'GraduationCap', 'BookOpen', 'Library', 'School', 'Notebook',
    'Pencil', 'Languages'
  ],
  'Животные': [
    'Dog', 'Cat', 'Bird', 'Fish', 'PawPrint', 'Bone'
  ]
} as const satisfies Record<string, readonly IconName[]>;
