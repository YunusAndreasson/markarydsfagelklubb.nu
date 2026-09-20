-- Dummy content for step 3 (docs/roadmap.md, F2): enough to build and judge
-- the site against until the WordPress import (step 8) brings the real thing.
--
-- Every row's slug starts with `exempel-`, and scripts/dummy-content-delete.sql
-- removes them all before the import. Re-runnable: nothing is inserted twice.
-- It writes only this repo's tables. Applied by a person:
--
--   supabase db query --linked -f scripts/dummy-content.sql
--
-- Bodies are written by hand to the sanitizer's allowlist (src/lib/sanitize.ts),
-- because SQL skips the save path that would otherwise sanitize them.

begin;

insert into public.categories (slug, name, sort_order) values
  ('exempel-foreningsaktuellt', 'Föreningsaktuellt', 10),
  ('exempel-referat', 'Referat', 20),
  ('exempel-program', 'Program', 30)
on conflict (slug) do nothing;

-- Articles, varied on purpose: one long with every kind of block, one without
-- an ingress, two from last year, one scheduled for next week, one draft.
insert into public.articles (slug, title, excerpt, author_name, category_id, status, published_at, body_html)
values
  (
    'exempel-strackrakning-pa-skararps-angar',
    'Sträckräkning på Skararps ängar',
    'Ett tiotal medlemmar räknade flyttfåglar i gryningen. Bofinkarna kom i tusental och en fjällvråk seglade lågt över ängarna.',
    'Anna Andersson',
    (select id from public.categories where slug = 'exempel-referat'),
    'published',
    now() - interval '2 days',
    $html$<p>Klockan halv sju stod vi på kullen vid Skararp med kikare och tubkikare. Det var klart och nästan vindstilla, och redan innan solen var uppe drog de första flockarna söderut.</p><h2>Morgonen</h2><p>Bofinkarna dominerade stort. Vi räknade dem i flockar om tjugo och kom till slut upp i drygt 3 400 individer. Mellan dem gick <em>Fringilla montifringilla</em>, bergfink, som lätt känns igen på sitt nasala läte.</p><blockquote><p>Det bästa med sträckräkning är att man aldrig vet vad som kommer över nästa trädtopp.</p></blockquote><h3>Rovfåglar</h3><p>Strax efter nio kom dagens höjdpunkt: en <strong>fjällvråk</strong> som seglade lågt över ängarna och sedan skruvade sig upp i termiken. Dessutom sågs:</p><ul><li><p>6 ormvråkar</p></li><li><p>2 sparvhökar</p></li><li><p>1 tornfalk som jagade längs vägen</p></li></ul><h3>Summering</h3><table><tbody><tr><th colspan="1" rowspan="1"><p>Art</p></th><th colspan="1" rowspan="1"><p>Antal</p></th></tr><tr><td colspan="1" rowspan="1"><p>Bofink</p></td><td colspan="1" rowspan="1"><p>3 400</p></td></tr><tr><td colspan="1" rowspan="1"><p>Bergfink</p></td><td colspan="1" rowspan="1"><p>220</p></td></tr><tr><td colspan="1" rowspan="1"><p>Ringduva</p></td><td colspan="1" rowspan="1"><p>1 150</p></td></tr><tr><td colspan="1" rowspan="1"><p>Fjällvråk</p></td><td colspan="1" rowspan="1"><p>1</p></td></tr></tbody></table><p>Alla observationer finns rapporterade på <a href="https://www.artportalen.se/">Artportalen</a>. Tack till alla som kom, och välkomna tillbaka nästa lördag.</p><ol><li><p>Samling vid parkeringen klockan 06.30.</p></li><li><p>Ta med varma kläder och något att dricka.</p></li></ol><p>Frågor om nästa räkning? Skriv till <a href="mailto:webmaster@markarydsfagelklubb.nu">webmaster@markarydsfagelklubb.nu</a>.</p>$html$
  ),
  (
    'exempel-arsmotet-2026',
    'Årsmötet 2026',
    'Styrelsen omvaldes och klubben fick en ny kassör. Protokollet finns hos sekreteraren.',
    'Styrelsen',
    (select id from public.categories where slug = 'exempel-foreningsaktuellt'),
    'published',
    now() - interval '23 days',
    $html$<p>Ett trettiotal medlemmar kom till årsmötet i Folkets hus. Verksamhetsberättelsen och kassarapporten godkändes, och styrelsen beviljades ansvarsfrihet.</p><p>Efter mötet visade Erik bilder från vårens resa till Öland.</p>$html$
  ),
  (
    'exempel-holkforsaljning',
    'Holkförsäljning i Folkets hus',
    '',
    '',
    (select id from public.categories where slug = 'exempel-foreningsaktuellt'),
    'published',
    now() - interval '6 weeks',
    $html$<p>Nu finns klubbens fågelholkar att köpa igen. Holkar för mesar, flugsnappare och starar. Betala med Swish eller kontant.</p>$html$
  ),
  (
    'exempel-ugglespaning-i-februari',
    'Ugglespaning i februari',
    'Vi lyssnade efter pärlugglor i skogarna norr om Markaryd. Två spelande hanar belönade den som stod ut i kylan.',
    'Per Persson',
    (select id from public.categories where slug = 'exempel-program'),
    'published',
    make_timestamptz(extract(year from now())::int - 1, 2, 21, 19, 0, 0, 'Europe/Stockholm'),
    $html$<p>Tolv medlemmar i fyra bilar körde ut efter mörkrets inbrott. Vid det tredje stoppet svarade en pärluggla direkt.</p>$html$
  ),
  (
    'exempel-sjofaglar-pa-hammarsjon',
    'Sjöfåglar på Hammarsjön',
    'Knipor, storskrakar och en ensam salskrake. Vintern har börjat på sjön.',
    'Anna Andersson',
    (select id from public.categories where slug = 'exempel-referat'),
    'published',
    make_timestamptz(extract(year from now())::int - 1, 11, 30, 10, 15, 0, 'Europe/Stockholm'),
    $html$<p>Isen hade ännu inte lagt sig, och i vakarna samlades sjöfåglarna.</p>$html$
  ),
  (
    'exempel-schemalagd-sjofagelrakning',
    'Sjöfågelräkning nästa helg',
    'Den här är schemalagd och syns först om en vecka.',
    '',
    (select id from public.categories where slug = 'exempel-program'),
    'published',
    now() + interval '7 days',
    $html$<p>Schemalagd exempelartikel.</p>$html$
  ),
  (
    'exempel-utkast-om-vinterfagelrallyt',
    'Utkast: Vinterfågelrallyt',
    'Ett utkast som bara syns i administrationen.',
    '',
    null,
    'draft',
    null,
    $html$<p>Utkast.</p>$html$
  )
on conflict (slug) do nothing;

-- Pages in the shape of the menu the club signed off (docs/design.md): a link
-- to the articles, a section of links out, and a section of pages, one of them
-- hidden from the menu and one still a draft.
insert into public.pages (parent_id, kind, slug, title, link_url, description, body_html, show_in_menu, sort_order, status, published_at)
values
  (null, 'link', 'exempel-artiklar', 'Artiklar', '/artiklar', '', '', true, 10, 'published', now() - interval '30 days'),
  -- Larm is a real section of the site (step 4), not dummy content, but the
  -- menu is built from the page tree, so it needs a row. Step 8 rebuilds the
  -- tree for real and keeps this entry (docs/design.md, "Menu proposal").
  (null, 'link', 'exempel-larm', 'Larm', '/larm', '', '', true, 15, 'published', now() - interval '30 days'),
  (null, 'page', 'exempel-obsar', 'Obsar', null, 'Rapportera, följ och räkna fåglarna i Markaryds kommun.', $html$<p>Klubbens medlemmar rapporterar sina fynd på Artportalen. Här hittar du vägen dit, och till listorna över kommunens fåglar.</p>$html$, true, 20, 'published', now() - interval '30 days'),
  (null, 'page', 'exempel-klubben', 'Klubben', null, 'Om Markaryds Fågelklubb och hur man blir medlem.', $html$<p>Markaryds Fågelklubb samlar alla som tycker om fåglar och natur i Markaryds kommun.</p>$html$, true, 30, 'published', now() - interval '30 days')
on conflict on constraint pages_parent_slug_unique do nothing;

insert into public.pages (parent_id, kind, slug, title, link_url, description, body_html, show_in_menu, sort_order, status, published_at)
select parent.id, child.kind, child.slug, child.title, child.link_url, child.description, child.body_html, child.show_in_menu, child.sort_order, child.status, child.published_at
from (values
  ('exempel-obsar', 'link', 'exempel-rapportera', 'Rapportera på Artportalen', 'https://www.artportalen.se/', '', '', true, 10, 'published', now() - interval '30 days'),
  ('exempel-obsar', 'link', 'exempel-arslista', 'Årslista', 'https://www.artportalen.se/List/Top/Species/F%C3%A5glar/2026/Kommun/Markaryd/AnySite/OrderByDate/Desc', '', '', true, 20, 'published', now() - interval '30 days'),
  ('exempel-klubben', 'page', 'exempel-verksamhet', 'Verksamhet', null, 'Utflykter, räkningar och träffar året runt.', $html$<p>Klubben ordnar utflykter, fågelräkningar och träffar. Mötesplats Ekebacken träffas varje tisdag under våren.</p>$html$, true, 10, 'published', now() - interval '30 days'),
  ('exempel-klubben', 'page', 'exempel-medlemskap', 'Medlemskap', null, 'Så blir du medlem, och vad det kostar.', $html$<p>Medlemskapet kostar 150 kronor om året. Familjemedlemskap 200 kronor.</p>$html$, true, 20, 'published', now() - interval '30 days'),
  ('exempel-klubben', 'page', 'exempel-styrelsen', 'Styrelsen', null, 'Vem som sitter i styrelsen.', $html$<p>En sida som inte syns i menyn men nås från avsnittet.</p>$html$, false, 30, 'published', now() - interval '30 days'),
  ('exempel-klubben', 'page', 'exempel-utkastsida', 'Utkastsida', null, '', $html$<p>Ett utkast.</p>$html$, true, 40, 'draft', null)
) as child(parent_slug, kind, slug, title, link_url, description, body_html, show_in_menu, sort_order, status, published_at)
join public.pages parent on parent.slug = child.parent_slug and parent.parent_id is null
on conflict on constraint pages_parent_slug_unique do nothing;

-- The programme (step 5). Its menu entry sits between Larm and Obsar, where
-- the signed-off menu puts it, and is labelled "Program" although the route is
-- /kalender (docs/roadmap.md, F3).
insert into public.pages (parent_id, kind, slug, title, link_url, description, body_html, show_in_menu, sort_order, status, published_at)
values
  (null, 'link', 'exempel-program', 'Program', '/kalender', '', '', true, 18, 'published', now() - interval '30 days')
on conflict on constraint pages_parent_slug_unique do nothing;

-- Events, varied on purpose: one soon with a time and an anmälan link, a
-- multi-day all-day trip, a meeting with a start and an end the same evening,
-- one that has been (so the month pages have something to show backwards), one
-- draft and one scheduled. All-day rows are stored at Swedish midnight, which
-- is what the admin form does too.
insert into public.events (slug, title, summary, place, kind, registration_url, starts_at, ends_at, all_day, status, published_at, body_html)
values
  (
    'exempel-ugglespaning-vid-hualtet',
    'Ugglespaning vid Hualtet',
    'Vi lyssnar efter pärluggla och sparvuggla i skymningen. Ta med ficklampa och något varmt att dricka.',
    'Samling vid Ekebacken',
    'exkursion',
    'mailto:webmaster@markarydsfagelklubb.nu',
    now() + interval '5 days',
    null,
    false,
    'published',
    now() - interval '10 days',
    $html$<p>Pärlugglan ropar som mest i mars och april, och Hualtet är en av kommunens säkraste lokaler. Vi står still och lyssnar, så klä dig varmare än du tror att du behöver.</p><p>Turen tar ungefär tre timmar och passar även den som är ovan. Kikare behövs inte i mörkret, men en ficklampa är bra att ha på vägen tillbaka.</p>$html$
  ),
  (
    'exempel-resa-till-falsterbo',
    'Resa till Falsterbo',
    'Två dagar vid Nabben när sträcket är som bäst. Vi samåker och övernattar i Skanör.',
    'Falsterbo',
    'resa',
    'mailto:webmaster@markarydsfagelklubb.nu',
    date_trunc('day', (now() + interval '24 days') at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm',
    date_trunc('day', (now() + interval '25 days') at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm',
    true,
    'published',
    now() - interval '10 days',
    $html$<p>Falsterbonäset i september är svårslaget. Med rätt vind drar rovfåglarna lågt över Nabben, och på morgonen är buskagen fulla av tättingar.</p><p>Anmäl dig senast en vecka innan, så ordnar vi samåkning.</p>$html$
  ),
  (
    'exempel-manadsmote-pa-ekebacken',
    'Månadsmöte på Ekebacken',
    'Bildvisning från sommarens resor, och kaffe.',
    'Ekebacken',
    'mote',
    null,
    now() + interval '40 days',
    now() + interval '40 days' + interval '2 hours',
    false,
    'published',
    now() - interval '10 days',
    $html$<p>Ta med dina egna bilder om du vill visa något. Vi har projektor.</p>$html$
  ),
  (
    'exempel-vinterfagelrally',
    'Vinterfågelrally',
    'Klubbens egen tävling: flest arter i kommunen under ett dygn.',
    'Hela kommunen',
    'tavling',
    null,
    date_trunc('day', (now() - interval '35 days') at time zone 'Europe/Stockholm') at time zone 'Europe/Stockholm',
    null,
    true,
    'published',
    now() - interval '60 days',
    $html$<p>Lagen startar när de vill och rapporterar till sekreteraren innan midnatt.</p>$html$
  ),
  (
    'exempel-utkastevenemang',
    'Utkastevenemang',
    'Ska inte synas på webbplatsen.',
    '',
    'ovrigt',
    null,
    now() + interval '12 days',
    null,
    false,
    'draft',
    null,
    $html$<p>Ett utkast.</p>$html$
  ),
  (
    'exempel-schemalagt-evenemang',
    'Schemalagt evenemang',
    'Syns först när publiceringstiden passerat.',
    'Ekebacken',
    'kurs',
    null,
    now() + interval '60 days',
    null,
    false,
    'published',
    now() + interval '30 days',
    $html$<p>Ett schemalagt evenemang.</p>$html$
  )
on conflict (slug) do nothing;

commit;
