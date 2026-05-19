import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllSkills, loadAllIntegrations, loadIntegrationCatalog, loadSkillCatalog } from '../loader.js';
import { INTEGRATION_COMPONENT_TYPE } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

describe('I/O', () => {
  it('loadSkillCatalog: 실제 skill-registry.json 로드', () => {
    const catalog = loadSkillCatalog(resolve(dataDir, 'skills'));
    expect(catalog.skills.length).toBeGreaterThan(0);
  });

  it('loadAllSkills: 실제 data/skills/ 26개 로드', () => {
    const skills = loadAllSkills(resolve(dataDir, 'skills'));
    expect(skills).toHaveLength(26);
  });

  it('loadIntegrationCatalog: 실제 integration-registry.json 로드', () => {
    const catalog = loadIntegrationCatalog(resolve(dataDir, 'integrations'));
    expect(catalog.integrations.map((integration) => integration.id)).toEqual(['context-promotion', 'pc']);
  });

  it('loadAllIntegrations: catalog를 id 순서로 로드한다', () => {
    const integrations = loadAllIntegrations(resolve(dataDir, 'integrations'));
    const skillIds = integrations.map(
      (integration) =>
        integration.components.find((component) => component.type === INTEGRATION_COMPONENT_TYPE.SKILL)?.id,
    );
    const receiptConfigIds = integrations.map(
      (integration) =>
        integration.components.find((component) => component.type === INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG)?.id,
    );
    expect(integrations.map((integration) => integration.id)).toEqual(['context-promotion', 'pc']);
    expect(skillIds).toEqual(['context-promotion-review', 'pc']);
    expect(receiptConfigIds).toEqual(['context-promotion-receipts', 'personal-project-contexts']);
  });

  it('spec lifecycle task skills는 preset에 자동 포함되지 않고 docs/specs 경로를 사용한다', () => {
    const skills = loadAllSkills(resolve(dataDir, 'skills'));
    const specSkills = skills.filter((skill) => skill.groups.includes('spec-lifecycle'));
    const contents = specSkills.flatMap((skill) => skill.files.map((file) => file.content));

    expect(specSkills.map((skill) => skill.id)).toEqual([
      'project-terminology-sync',
      'spec-baseline-sync',
      'spec-product-01-idea-to-brief',
      'spec-product-02-brief-to-technical-context',
      'spec-product-03-brief-to-product-spec',
      'spec-product-04-product-spec-to-ui-spec',
      'spec-product-05-spec-to-work-packets',
    ]);
    expect(specSkills.every((skill) => skill.kind === 'task')).toBe(true);
    expect(contents.some((content) => content.includes('./docs/specs/'))).toBe(true);
    expect(contents.some((content) => content.includes('./specs/'))).toBe(false);
  });
});
