import type { FeatureStoreState, CustomerFeature, SalespersonFeature, IndustryFeature } from './types';

export class FeatureStore {
  private state: FeatureStoreState = {
    customerFeatures: {},
    dealFeatures: {},
    salespersonFeatures: {},
    industryFeatures: {},
    lastUpdated: new Date().toISOString()
  };

  public updateStore(newState: FeatureStoreState) {
    this.state = newState;
  }

  public getStore(): FeatureStoreState {
    return this.state;
  }

  public getCustomerFeature(customerName: string): CustomerFeature | undefined {
    return this.state.customerFeatures[customerName];
  }

  public getSalespersonFeature(salesRep: string): SalespersonFeature | undefined {
    return this.state.salespersonFeatures[salesRep];
  }

  public getIndustryFeature(industry: string): IndustryFeature | undefined {
    return this.state.industryFeatures[industry];
  }

  public getAllCustomerFeatures(): CustomerFeature[] {
    return Object.values(this.state.customerFeatures);
  }

  public getAllSalespersonFeatures(): SalespersonFeature[] {
    return Object.values(this.state.salespersonFeatures);
  }
}

export const globalFeatureStore = new FeatureStore();
