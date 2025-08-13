import { render, screen } from '@testing-library/react';
import RootLayout from './layout';

test('PWA Manifest', () => {
  render(<RootLayout />);
  const manifestLink = screen.getByRole('link', { name: /manifest\.json/i });
  expect(manifestLink).toBeInTheDocument();
  expect(manifestLink.href).toContain('/manifest.json');
});
```
