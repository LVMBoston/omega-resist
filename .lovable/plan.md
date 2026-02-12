

# Add `utm_medium` Column to EventsV2 Table

## Changes

All changes are in `src/pages/CampaignDashboard.tsx`.

### 1. Table Header — Insert after "Event Level" column (line ~1658)

Add a new sortable `TableHead` for `utm_medium` between the "Event Level" and "utm_content" columns:

```tsx
<TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('utm_medium')}>
  <div className="flex items-center gap-1">
    utm_medium
    {sortConfig.column === 'utm_medium' && <ArrowUpDown className="w-3 h-3" />}
  </div>
</TableHead>
```

### 2. Table Body — Insert cell after the Event Level badge (line ~1692)

Add a new `TableCell` displaying the token's `utm_medium` value:

```tsx
<TableCell className="font-mono text-xs">
  {event.tokens?.utm_medium || 'N/A'}
</TableCell>
```

### 3. CSV Export — Add to headers and data rows (lines ~540, ~560)

- Add `"utm_medium"` to the `headers` array after `"Event Level"`
- Add `event.tokens?.utm_medium || ""` to the CSV row data array after the level value

### 4. Sort Logic

The existing `handleSort` function already accesses nested token fields via dot notation. The sort key `'utm_medium'` will need to resolve to `event.tokens.utm_medium`. I will verify the sort handler supports this path and add it if needed.

## What stays the same

- No database or schema changes
- No new dependencies
- The query already fetches token data including `utm_medium` via the join

