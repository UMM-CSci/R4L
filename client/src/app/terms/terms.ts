export interface Terms {
  item: string[];
  brand: string[];
  color: string[];
  size: string[];
  type: string[];
  material: string[];
  itemPackageModes?: Record<string, ItemPackageMode>;
}

export type ItemPackageMode = 'INDIVIDUAL' | 'PACKAGED';
