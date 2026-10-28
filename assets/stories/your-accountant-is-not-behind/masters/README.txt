Master images for /stories/your-accountant-is-not-behind
========================================================

These masters are kept in the repository (.vercelignore keeps this
folder off the deployment), so the derivatives can be rebuilt without
another upload.

  01-banner.png          Masthead. The P9-A12-F07 alt2 ad creative, 4:5
                         (Restaurant Ads\statics\final\P9-A12-F07_4x5_alt2_v1.png).
  02-the-door.png        The owner in the doorway with two cups of chai.
  03-the-night.png       Night at the accountant's desk, phone of late bills.
  04-the-upload.png      An outlet manager photographs a bill at the counter.
  05-outlet-2-books.png  Product screen: Outlet 2's September books with
                         each entry's source. No window chrome; the site
                         draws it (.screen-window::before).
  06-ask-outlet-2.png    Product screen: Ask GeniusCFO, "Did Outlet 2 make
                         money in September?", with its documents.
  07-social.png          Share card. The 1:1 version of the ad creative.
  08-the-question.png    Next morning: the accountant points at one bill,
                         the owner leans in.

02 to 04 and 08 were generated with reAPI (gpt-image-2.5-sunburst); prompts are
in D:\Clients\GCFO Work\reAPI\prompts\STORY-P9_*.txt. 05 and 06 are
rendered from the restaurant frames' screen designs.

Rebuild from the repository root:

  python3 tools/build-story-images.py your-accountant-is-not-behind
