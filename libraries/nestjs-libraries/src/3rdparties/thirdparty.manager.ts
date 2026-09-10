import { Injectable } from '@nestjs/common';
import { getLaunchCapabilities } from '@gitroom/helpers/configuration/launch.capabilities';
import { assertLaunchFeature } from '@gitroom/nestjs-libraries/services/launch.policy';
import {
  ThirdPartyAbstract,
  ThirdPartyParams,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { ModuleRef } from '@nestjs/core';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';

@Injectable()
export class ThirdPartyManager {
  constructor(
    private _moduleRef: ModuleRef,
    private _thirdPartyService: ThirdPartyService
  ) {}

  getAllThirdParties(): any[] {
    if (!getLaunchCapabilities().hostedAi) return [];
    return (Reflect.getMetadata('third:party', ThirdPartyAbstract) || []).map(
      (p: any) => ({
        identifier: p.identifier,
        title: p.title,
        description: p.description,
        fields: p.fields || [],
      })
    );
  }

  getThirdPartyByName(
    identifier: string
  ): (ThirdPartyParams & { instance: ThirdPartyAbstract }) | undefined {
    assertLaunchFeature('hostedAi');
    const thirdParty = (
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || []
    ).find((p: any) => p.identifier === identifier);

    return { ...thirdParty, instance: this._moduleRef.get(thirdParty.target) };
  }

  deleteIntegration(org: string, id: string) {
    return this._thirdPartyService.deleteIntegration(org, id);
  }

  getIntegrationById(org: string, id: string) {
    assertLaunchFeature('hostedAi');
    return this._thirdPartyService.getIntegrationById(org, id);
  }

  getAllThirdPartiesByOrganization(org: string) {
    if (!getLaunchCapabilities().hostedAi) return [];
    return this._thirdPartyService.getAllThirdPartiesByOrganization(org);
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    assertLaunchFeature('hostedAi');
    return this._thirdPartyService.saveIntegration(
      org,
      identifier,
      apiKey,
      data
    );
  }
}
