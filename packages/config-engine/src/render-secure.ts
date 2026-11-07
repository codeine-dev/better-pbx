import { renderPjsipAcl } from './policy/acl.js';
import { scanRenderedConfig } from './policy/rendered.js';
import { SecurityPolicyError } from './policy/security.js';
import { renderTree } from './render/index.js';
import { resolvePaths, type RenderInput, type RenderedTree } from './render/types.js';
import { assertValidModel } from './validate/model.js';

/**
 * The single supported entry point for producing an applicable configuration tree.
 *
 * It validates the model (schema, security policy, and cross-resource references), renders,
 * generates the runtime ACL, and scans the final text for regressions. A caller must not call
 * `renderTree` directly to apply configuration; `renderTree` is exposed for golden tests and
 * inspection only.
 */
export function renderSecure(input: RenderInput): RenderedTree {
  const model = assertValidModel(input.model, input.policy ?? {});

  const tree = renderTree(model, input.options);
  const paths = resolvePaths(input.options);
  tree.runtimeFiles[`${paths.dataDir}/runtime/pjsip-acl.conf`] = renderPjsipAcl(
    model,
    input.runtime,
  );

  const issues = scanRenderedConfig({ ...tree.files, ...tree.runtimeFiles }, input.policy ?? {});
  if (issues.length > 0) throw new SecurityPolicyError(issues);

  return tree;
}
