import { useLocation } from 'react-router-dom';
import { findModuleByPath } from '../lib/modules';
import { useSession } from '../lib/session';
import { PageHeader, Card, CardContent } from '../components/ui/card';

export function PlaceholderPage() {
  const { session } = useSession();
  const location = useLocation();
  const module = findModuleByPath(session!, location.pathname);
  const label = module?.label ?? 'This module';

  return (
    <div>
      <PageHeader title={label} subtitle={module?.description} />
      <Card>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-foreground">
              {label} is not built yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Arriving in a later delivery slice. Nothing on this screen is live, and no data is
              shown here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
