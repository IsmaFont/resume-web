# README for Helm Chart Deployment

## Overview
This is a production-ready Helm chart for the resume-web application, designed to work seamlessly with FluxCD for GitOps-based deployments.

## Chart Structure
```
helm/resume-web/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default configuration values
└── templates/
    ├── deployment.yaml       # Kubernetes Deployment
    ├── service.yaml          # Kubernetes Service
    ├── serviceaccount.yaml   # Service Account
    ├── hpa.yaml             # Horizontal Pod Autoscaler
    ├── ingress.yaml         # Ingress configuration
    ├── _helpers.tpl         # Helper templates
    └── NOTES.txt            # Post-install notes
```

## Building & Pushing the Chart to OCI Registry

### Prerequisites
- Docker or Podman
- Helm 3.8+
- Access to your OCI registry (e.g., Azure Container Registry, Docker Registry, etc.)

### Steps

1. **Package the chart**:
   ```bash
   helm package helm/resume-web
   ```
   This creates `resume-web-1.0.0.tgz`

2. **Login to OCI registry**:
   ```bash
   # For Azure Container Registry
   az acr login --name my-registry
   
   # For Docker Registry
   docker login my-registry.azurecr.io
   ```

3. **Push to OCI registry**:
   ```bash
   helm push resume-web-1.0.0.tgz oci://my-registry.azurecr.io/helm-charts
   ```

4. **Verify the chart**:
   ```bash
   helm pull oci://my-registry.azurecr.io/helm-charts/resume-web --version 1.0.0
   ```

## Deploying with FluxCD

### 1. Create HelmRepository Source
Create a `helm-repository.yaml` in your FluxCD repository (see `example-helm-repository.yaml`):

```bash
kubectl apply -f clusters/base/helm-repositories.yaml
```

### 2. Create HelmRelease
Create a `resume-web-release.yaml` (see `example-fluxcd-release.yaml`):

```bash
kubectl apply -f clusters/production/resume-web-release.yaml
```

### 3. Monitor Deployment
```bash
# Check HelmRepository status
kubectl get helmrepository -A

# Check HelmRelease status
kubectl get helmrelease -A

# Watch the deployment
kubectl get deployment -w

# View logs
kubectl logs -f deployment/resume-web
```

## Customization

### Common Values to Override

#### Production Deployment
```yaml
replicaCount: 3
image:
  tag: "v1.0.0"  # Use specific version tags
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
ingress:
  enabled: true
  hosts:
    - host: resume.example.com
      paths:
        - path: /
          pathType: Prefix
```

#### Development Deployment
```yaml
replicaCount: 1
image:
  pullPolicy: Always
resources:
  limits:
    cpu: 200m
    memory: 200Mi
  requests:
    cpu: 100m
    memory: 100Mi
```

### Overriding Values in HelmRelease
```yaml
spec:
  values:
    replicaCount: 2
    image:
      tag: "latest"
```

## Security Features

The chart includes:
- Non-root user execution (UID 1001)
- Security context with dropped capabilities
- Read-only root filesystem
- Resource limits and requests
- Health checks (liveness and readiness probes)
- ServiceAccount with RBAC support

## Local Testing

### Install locally
```bash
helm install my-resume helm/resume-web
```

### Dry-run
```bash
helm install my-resume helm/resume-web --dry-run --debug
```

### Template rendering
```bash
helm template my-resume helm/resume-web
```

### Lint the chart
```bash
helm lint helm/resume-web
```

## Troubleshooting

### Pod won't start
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Image pull issues
Ensure the image tag in values.yaml matches your built and pushed image:
```yaml
image:
  repository: my-registry.azurecr.io/resume-web
  tag: "v1.0.0"
```

### HelmRelease reconciliation issues
```bash
kubectl get helmrelease -A
kubectl describe helmrelease resume-web
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

## Cleanup

Remove the deployment:
```bash
helm uninstall resume-web
```

Or let FluxCD handle it by removing the HelmRelease resource.
