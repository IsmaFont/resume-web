# FluxCD Image Automation Setup

This guide explains how to set up automatic image updates with FluxCD for the resume-web application.

## How It Works

```
Your CI/CD Pipeline
        ↓
    Build & Push Image to OCI Registry
        ↓
    ImageRepository Scans Registry (every 1m)
        ↓
    ImagePolicy Selects Latest Version (semver, alphabetical, etc.)
        ↓
    ImageUpdateAutomation Detects New Version
        ↓
    Updates HelmRelease YAML in Git Repository
        ↓
    Git Commit Pushed to Repository
        ↓
    HelmRelease Detects Change & Redeploys
        ↓
    New Image Version Running in Kubernetes
```

## Prerequisites

1. **Flux Image Automation Controller** installed:
   ```bash
   flux install --components-extra image.fluxcd.io/image-reflector-controller,image.fluxcd.io/image-automation-controller
   ```

2. **GitRepository Source** in Flux (for updating Git):
   ```bash
   flux create source git resume-web-gitops \
     --url=https://github.com/your-org/gitops-repo \
     --branch=main
   ```

## Setup Steps

### 1. Create ImageRepository
The ImageRepository scans your OCI registry for new tags:

```bash
kubectl apply -f helm/example-image-automation.yaml
```

Check status:
```bash
kubectl get imagerepository -n flux-system
kubectl describe imagerepository resume-web -n flux-system
```

### 2. Create ImagePolicy
Defines which tags to track (semver, alphabetical, etc.):

Already included in `example-image-automation.yaml`.

Check available tags:
```bash
flux get image policy -n flux-system
```

### 3. Update HelmRelease with Markers
Add automation markers to your HelmRelease so Flux knows where to update the image tag.

Edit your HelmRelease file (e.g., `clusters/production/resume-web-release.yaml`):

```yaml
spec:
  values:
    image:
      repository: my-registry.azurecr.io/resume-web
      # FluxCD automation marker
      tag: "v1.0.0"  # {"$imagetag": "flux-system:resume-web:tag"}
```

Or if you want to update the full image reference:
```yaml
spec:
  values:
    image:
      # {"$imagepolicy": "flux-system:resume-web"}
      repository: my-registry.azurecr.io/resume-web
      tag: "v1.0.0"
```

### 4. Configure Git Authentication for Push

Create credentials secret:
```bash
# Using GitHub token
kubectl create secret generic flux-git-credentials \
  --from-literal=username=git \
  --from-literal=password=$GITHUB_TOKEN \
  -n flux-system
```

Update ImageUpdateAutomation to use credentials:
```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: resume-web
  namespace: flux-system
spec:
  ...
  push:
    branch: main
  git:
    push:
      branch: main
    commit:
      author:
        name: FluxCD
        email: fluxcd@example.com
```

### 5. Create ImageUpdateAutomation
This controller automatically commits updates back to Git:

```bash
kubectl apply -f helm/example-image-automation.yaml
```

Check status:
```bash
kubectl get imageupdateautomation -n flux-system
kubectl describe imageupdateautomation resume-web -n flux-system
```

## Verification

### 1. Check ImageRepository is scanning:
```bash
kubectl get imagerepository -A
kubectl logs -n flux-system -f deployment/image-reflector-controller
```

### 2. Check ImagePolicy has found images:
```bash
flux get image policy -A
```

### 3. Monitor ImageUpdateAutomation:
```bash
kubectl logs -n flux-system -f deployment/image-automation-controller
```

### 4. Verify Git commits:
When a new image is detected, you should see a commit in your Git repository with:
```
chore(image): update resume-web:v1.1.0
```

## Image Versioning Strategies

### Semantic Versioning (Recommended)
```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: resume-web
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: resume-web
  policy:
    semver:
      range: '>=1.0.0 <2.0.0'  # Only patch/minor updates in v1.x
```

### Latest/Alphabetical
```yaml
policy:
  alphabetical:
    order: asc  # or 'desc' for descending
```

### Numerical
```yaml
policy:
  numerical:
    order: asc
```

## Advanced: Multi-Environment Setup

### Production (only semver tags)
```yaml
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: resume-web-prod
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: resume-web
  policy:
    semver:
      range: '>=1.0.0 <2.0.0'
```

### Staging (all tags)
```yaml
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: resume-web-staging
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: resume-web
  policy:
    alphabetical:
      order: asc
```

Then update different HelmReleases to use different policies:
```yaml
# production/resume-web-release.yaml
values:
  image:
    tag: "v1.0.0"  # {"$imagetag": "flux-system:resume-web-prod:tag"}

# staging/resume-web-release.yaml
values:
  image:
    tag: "latest"  # {"$imagetag": "flux-system:resume-web-staging:tag"}
```

## CI/CD Integration: Building and Pushing Images

### GitHub Actions Example
```yaml
name: Build and Push Image

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'Dockerfile'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Login to Registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login -u "${{ secrets.REGISTRY_USERNAME }}" --password-stdin my-registry.azurecr.io
      
      - name: Build Image
        run: |
          docker build -t my-registry.azurecr.io/resume-web:${{ github.sha }} .
          docker tag my-registry.azurecr.io/resume-web:${{ github.sha }} my-registry.azurecr.io/resume-web:latest
      
      - name: Push Image
        run: |
          docker push my-registry.azurecr.io/resume-web:${{ github.sha }}
          docker push my-registry.azurecr.io/resume-web:latest
      
      - name: Push Semantic Version (if tagged)
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          docker tag my-registry.azurecr.io/resume-web:${{ github.sha }} my-registry.azurecr.io/resume-web:$VERSION
          docker push my-registry.azurecr.io/resume-web:$VERSION
```

### GitLab CI Example
```yaml
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
    - |
      if [[ "$CI_COMMIT_TAG" ]]; then
        docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG
        docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_TAG
      fi
```

## Troubleshooting

### ImageRepository not scanning
```bash
kubectl logs -n flux-system -f deployment/image-reflector-controller
# Check for authentication errors or network issues
```

### ImagePolicy not finding images
```bash
kubectl get imagepolicy -n flux-system -o yaml
# Verify policy matches your image tag format
```

### ImageUpdateAutomation not committing
```bash
kubectl logs -n flux-system -f deployment/image-automation-controller
# Check Git credentials and write permissions
```

### Manual verification
```bash
# Check what images are available
flux get images all -A

# Manually reconcile
flux reconcile image policy resume-web -n flux-system

# Force reconcile
flux reconcile image update resume-web -n flux-system --with-source
```

## Cleanup

Remove image automation:
```bash
kubectl delete imagerepository resume-web -n flux-system
kubectl delete imagepolicy resume-web -n flux-system
kubectl delete imageupdateautomation resume-web -n flux-system
```

## References
- [Flux Image Automation Documentation](https://fluxcd.io/flux/guides/image-update/)
- [ImagePolicy API Reference](https://fluxcd.io/flux/components/image/imagepolicies/)
- [ImageUpdateAutomation API Reference](https://fluxcd.io/flux/components/image/imageupdateautomations/)
