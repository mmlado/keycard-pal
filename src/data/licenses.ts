import { APP_NAME } from '@/constants/app';

export type LicenseEntry = {
  package: string;
  licenseType: string;
};

// ---------------------------------------------------------------------------
// License texts keyed by SPDX identifier
// ---------------------------------------------------------------------------

const MIT = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC = `ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const APACHE_2 = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

"License" shall mean the terms and conditions for use, reproduction, and
distribution as defined by Sections 1 through 9 of this document.

"Licensor" shall mean the copyright owner or entity authorized by the
copyright owner that is granting the License.

"Legal Entity" shall mean the union of the acting entity and all other
entities that control, are controlled by, or are under common control with
that entity.

"You" (or "Your") shall mean an individual or Legal Entity exercising
permissions granted by this License.

"Source" form shall mean the preferred form for making modifications,
including but not limited to software source code, documentation source, and
configuration files.

"Object" form shall mean any form resulting from mechanical transformation or
translation of a Source form, including but not limited to compiled object
code, generated documentation, and conversions to other media types.

"Work" shall mean the work of authorship made available under the License, as
indicated by a copyright notice that is included in or attached to the work.

"Derivative Works" shall mean any work that is based on (or derived from) the
Work and for which the editorial revisions, annotations, elaborations, or
other modifications represent, as a whole, an original work of authorship.

"Contribution" shall mean any work of authorship, including the original
version of the Work and any modifications or additions to that Work, that is
intentionally submitted to the Licensor for inclusion in the Work.

"Contributor" shall mean Licensor and any Legal Entity on behalf of whom a
Contribution has been received by the Licensor and included within the Work.

2. Grant of Copyright License.

Subject to the terms and conditions of this License, each Contributor hereby
grants to You a perpetual, worldwide, non-exclusive, no-charge,
royalty-free, irrevocable copyright license to reproduce, prepare Derivative
Works of, publicly display, publicly perform, sublicense, and distribute the
Work and such Derivative Works in Source or Object form.

3. Grant of Patent License.

Subject to the terms and conditions of this License, each Contributor hereby
grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free,
irrevocable patent license to make, have made, use, offer to sell, sell,
import, and otherwise transfer the Work, where such license applies only to
those patent claims licensable by such Contributor that are necessarily
infringed by their Contribution(s) alone or by combination of their
Contribution(s) with the Work to which such Contribution(s) was submitted.

4. Redistribution.

You may reproduce and distribute copies of the Work or Derivative Works
thereof in any medium, with or without modifications, and in Source or Object
form, provided that You meet the following conditions:

(a) You must give any other recipients of the Work or Derivative Works a copy
of this License; and

(b) You must cause any modified files to carry prominent notices stating that
You changed the files; and

(c) You must retain, in the Source form of any Derivative Works that You
distribute, all copyright, patent, trademark, and attribution notices from the
Source form of the Work, excluding those notices that do not pertain to any
part of the Derivative Works; and

(d) If the Work includes a "NOTICE" text file as part of its distribution, You
must include a readable copy of the attribution notices contained within such
NOTICE file, in at least one of the following places: within a NOTICE text
file distributed as part of the Derivative Works; within the Source form or
documentation, if provided along with the Derivative Works; or, within a
display generated by the Derivative Works, if and wherever such third-party
notices normally appear.

You may add Your own attribution notices within Derivative Works that You
distribute, alongside or as an addendum to the NOTICE text from the Work,
provided that such additional attribution notices cannot be construed as
modifying the License.

5. Submission of Contributions.

Unless You explicitly state otherwise, any Contribution intentionally
submitted for inclusion in the Work shall be under the terms and conditions of
this License, without any additional terms or conditions.

6. Trademarks.

This License does not grant permission to use the trade names, trademarks,
service marks, or product names of the Licensor, except as required for
reasonable and customary use in describing the origin of the Work.

7. Disclaimer of Warranty.

UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING, LICENSOR PROVIDES
THE WORK (AND EACH CONTRIBUTOR PROVIDES ITS CONTRIBUTIONS) ON AN "AS IS"
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR
IMPLIED, INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE,
NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE. YOU
ARE SOLELY RESPONSIBLE FOR DETERMINING THE APPROPRIATENESS OF USING OR
REDISTRIBUTING THE WORK AND ASSUME ANY RISKS ASSOCIATED WITH YOUR EXERCISE OF
PERMISSIONS UNDER THIS LICENSE.

8. Limitation of Liability.

IN NO EVENT AND UNDER NO LEGAL THEORY, WHETHER IN TORT (INCLUDING NEGLIGENCE),
CONTRACT, OR OTHERWISE, UNLESS REQUIRED BY APPLICABLE LAW (SUCH AS DELIBERATE
AND GROSSLY NEGLIGENT ACTS) OR AGREED TO IN WRITING, SHALL ANY CONTRIBUTOR BE
LIABLE TO YOU FOR DAMAGES, INCLUDING ANY DIRECT, INDIRECT, SPECIAL,
INCIDENTAL, OR CONSEQUENTIAL DAMAGES OF ANY CHARACTER ARISING AS A RESULT OF
THIS LICENSE OR OUT OF THE USE OR INABILITY TO USE THE WORK.

9. Accepting Warranty or Additional Liability.

While redistributing the Work or Derivative Works thereof, You may choose to
offer, and charge a fee for, acceptance of support, warranty, indemnity, or
other liability obligations and/or rights consistent with this License.
However, in accepting such obligations, You may act only on Your own behalf
and on Your sole responsibility, not on behalf of any other Contributor, and
only if You agree to indemnify, defend, and hold each Contributor harmless for
any liability incurred by, or claims asserted against, such Contributor by
reason of your accepting any such warranty or additional liability.

END OF TERMS AND CONDITIONS`;

const MPL_2 = `Mozilla Public License Version 2.0

1. Definitions

1.1. "Contributor" means each individual or legal entity that creates,
contributes to the creation of, or owns Covered Software.

1.2. "Contributor Version" means the combination of the Contributions of
others (if any) used by a Contributor and that particular Contributor's
Contribution.

1.3. "Contribution" means Covered Software of a particular Contributor.

1.4. "Covered Software" means Source Code Form to which the initial
Contributor has attached the notice in Exhibit A, the Executable Form of such
Source Code Form, and Modifications of such Source Code Form, in each case
including portions thereof.

1.5. "Incompatible With Secondary Licenses" means:
(a) that the initial Contributor has attached the notice described in Exhibit
B to the Covered Software; or
(b) that the Covered Software was made available under the terms of version
1.1 or earlier of the License, but not also under the terms of a Secondary
License.

1.6. "Executable Form" means any form of the work other than Source Code Form.

1.7. "Larger Work" means a work that combines Covered Software with other
material, in a separate file or files, that is not Covered Software.

1.8. "License" means this document.

1.9. "Licensable" means having the right to grant, to the maximum extent
possible, whether at the time of the initial grant or subsequently, any and
all of the rights conveyed by this License.

1.10. "Modifications" means any of the following:
(a) any file in Source Code Form that results from an addition to, deletion
from, or modification of the contents of Covered Software; or
(b) any new file in Source Code Form that contains any Covered Software.

1.11. "Patent Claims" of a Contributor means any patent claim(s), owned or
controlled by the Contributor, whether already acquired or hereafter acquired,
that would be infringed by some manner of making, using, or selling its
Contribution alone or when combined with its Contributor Version.

1.12. "Secondary License" means either the GNU General Public License, Version
2.0, the GNU Lesser General Public License, Version 2.1, the GNU Affero
General Public License, Version 3.0, or any later versions of those licenses.

1.13. "Source Code Form" means the form of the work preferred for making
modifications.

1.14. "You" (or "Your") means an individual or a legal entity exercising
rights under this License.

2. License Grants and Conditions

2.1. Grants
Each Contributor hereby grants You a world-wide, royalty-free, non-exclusive
license: (a) under intellectual property rights (other than patent or
trademark) Licensable by such Contributor to use, reproduce, make available,
prepare derivative works of, distribute, and otherwise exploit its
Contributions, either on an unmodified basis, with Modifications, or as part
of a Larger Work; and (b) under Patent Claims of such Contributor to make,
use, sell, offer for sale, have made, import, and otherwise transfer either
its Contributions or its Contributor Version.

2.2. Effective Date
The licenses granted in Section 2.1 with respect to any Contribution become
effective for each Contribution on the date the Contributor first distributes
such Contribution.

2.3. Limitations on Grant Scope
The licenses granted in this Section 2 are the only rights granted under this
License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.

2.4. Subsequent Licenses
No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this License.

2.5. Representation
Each Contributor represents that the Contributor believes its Contributions
are its original creation(s) or it has sufficient rights to grant the rights
to its Contributions conveyed by this License.

2.6. Fair Use
This License is not intended to limit any rights You have under applicable
copyright doctrines of fair use, fair dealing, or other equivalents.

2.7. Conditions
Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted in
Section 2.1.

3. Responsibilities

3.1. Distribution of Source Form
All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under the
terms of this License. You must inform recipients that the Source Code Form of
the Covered Software is governed by the terms of this License, and how they
can obtain a copy of this License.

3.2. Distribution of Executable Form
If You distribute Covered Software in Executable Form then: (a) such Covered
Software must also be made available in Source Code Form, and You must inform
recipients of the Executable Form how they can obtain a copy of such Source
Code Form by reasonable means in a timely manner, at a charge no more than the
cost of distribution to the recipient; and (b) You may distribute such
Executable Form under the terms of this License, or sublicense it under
different terms, provided that the license for the Executable Form does not
attempt to limit or alter the recipients' rights in the Source Code Form under
this License.

3.3. Distribution of a Larger Work
You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for the
Covered Software.

3.4. Notices
You may not remove or alter the substance of any license notices (including
copyright notices, patent notices, disclaimers of warranty, or limitations of
liability) contained within the Source Code Form of the Covered Software,
except that You may alter any license notices to the extent required to remedy
known factual inaccuracies.

3.5. Application of Additional Terms
You may choose to offer, and to charge a fee for, warranty, support,
indemnity or other liability obligations to one or more recipients of Covered
Software.

4. Inability to Comply Due to Statute or Regulation

If it is impossible for You to comply with any of the terms of this License
with respect to some or all of the Covered Software due to statute, judicial
order, or regulation then You must: (a) comply with the terms of this License
to the maximum extent possible; and (b) describe the limitations and the code
they affect. Such description must be placed in a text file included with all
distributions of the Covered Software under this License.

5. Termination

5.1. The rights granted under this License will terminate automatically if You
fail to comply with any of its terms. However, if You become compliant, then
the rights granted under this License from a particular Contributor are
reinstated provisionally.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim alleging that a Contributor Version directly or indirectly
infringes any patent, then the rights granted to You by any and all
Contributors for the Covered Software under Section 2.1 will terminate.

6. Disclaimer of Warranty

COVERED SOFTWARE IS PROVIDED UNDER THIS LICENSE ON AN "AS IS" BASIS, WITHOUT
WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, WITHOUT
LIMITATION, WARRANTIES THAT THE COVERED SOFTWARE IS FREE OF DEFECTS,
MERCHANTABLE, FIT FOR A PARTICULAR PURPOSE OR NON-INFRINGING. THE ENTIRE RISK
AS TO THE QUALITY AND PERFORMANCE OF THE COVERED SOFTWARE IS WITH YOU. SHOULD
ANY COVERED SOFTWARE PROVE DEFECTIVE IN ANY RESPECT, YOU (NOT ANY CONTRIBUTOR)
ASSUME THE COST OF ANY NECESSARY SERVICING, REPAIR, OR CORRECTION.

7. Disclaimer of Liability

UNDER NO CIRCUMSTANCES AND UNDER NO LEGAL THEORY, WHETHER TORT (INCLUDING
NEGLIGENCE), CONTRACT, OR OTHERWISE, SHALL ANY CONTRIBUTOR, OR ANYONE WHO
DISTRIBUTES COVERED SOFTWARE AS PERMITTED ABOVE, BE LIABLE TO YOU FOR ANY
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES OF ANY
CHARACTER INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOST PROFITS, LOSS OF
GOODWILL, WORK STOPPAGE, COMPUTER FAILURE OR MALFUNCTION, OR ANY AND ALL
OTHER COMMERCIAL DAMAGES OR LOSSES, EVEN IF SUCH PARTY SHALL HAVE BEEN
INFORMED OF THE POSSIBILITY OF SUCH DAMAGES.

8. Litigation

Any litigation relating to this License may be brought only in the courts of
a jurisdiction where the defendant maintains its principal place of business
and such litigation shall be governed by laws of that jurisdiction, without
reference to its conflict-of-law provisions.

9. Miscellaneous

This License represents the complete agreement concerning the subject matter
hereof. If any provision of this License is held to be unenforceable, such
provision shall be reformed only to the extent necessary to make it
enforceable.

10. Versions of the License

10.1. New Versions
Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or publish
new versions of this License.

10.2. Effect of New Versions
You may distribute the Covered Software under the terms of the version of the
License under which You originally received the Covered Software, or under the
terms of any subsequent version published by the license steward.

10.3. Modified Versions
If you create software not governed by this License, and you want to create a
new license for such software, you may create and publish a new version of
this License with changes, provided that you change the name of the license.

Exhibit A - Source Code Form License Notice

This Source Code Form is subject to the terms of the Mozilla Public License,
v. 2.0. If a copy of the MPL was not distributed with this file, You can
obtain one at https://mozilla.org/MPL/2.0/.

Exhibit B - "Incompatible With Secondary Licenses" Notice

This Source Code Form is "Incompatible With Secondary Licenses", as defined
by the Mozilla Public License, v. 2.0.`;

export const LICENSE_TEXTS: Record<string, string> = {
  MIT,
  ISC,
  'Apache-2.0': APACHE_2,
  'MPL-2.0': MPL_2,
};

// ---------------------------------------------------------------------------
// Keycard Pal own license + all 3rd-party packages
// ---------------------------------------------------------------------------

export const licenses: LicenseEntry[] = [
  { package: APP_NAME, licenseType: 'MIT' },
  { package: '@ethereumjs/rlp', licenseType: 'MPL-2.0' },
  { package: '@keystonehq/bc-ur-registry', licenseType: 'Apache-2.0' },
  { package: '@keystonehq/bc-ur-registry-eth', licenseType: 'ISC' },
  { package: '@ngraveio/bc-ur', licenseType: 'MIT' },
  { package: '@noble/hashes', licenseType: 'MIT' },
  { package: '@noble/secp256k1', licenseType: 'MIT' },
  { package: '@react-native-clipboard/clipboard', licenseType: 'MIT' },
  { package: '@react-native-community/blur', licenseType: 'MIT' },
  { package: '@react-native/new-app-screen', licenseType: 'MIT' },
  { package: '@react-navigation/native', licenseType: 'MIT' },
  { package: '@react-navigation/native-stack', licenseType: 'MIT' },
  { package: '@scure/base', licenseType: 'MIT' },
  { package: '@scure/bip32', licenseType: 'MIT' },
  { package: '@scure/bip39', licenseType: 'MIT' },
  { package: 'bitcoinjs-lib', licenseType: 'MIT' },
  { package: 'keycard-sdk', licenseType: 'MIT' },
  { package: 'node-libs-react-native', licenseType: 'MIT' },
  { package: 'react', licenseType: 'MIT' },
  { package: 'react-native', licenseType: 'MIT' },
  { package: 'react-native-animated-ur-qr', licenseType: 'MIT' },
  { package: 'react-native-encrypted-storage', licenseType: 'MIT' },
  { package: 'react-native-get-random-values', licenseType: 'MIT' },
  { package: 'react-native-keycard', licenseType: 'MIT' },
  { package: 'react-native-paper', licenseType: 'MIT' },
  { package: 'react-native-qrcode-svg', licenseType: 'MIT' },
  { package: 'react-native-safe-area-context', licenseType: 'MIT' },
  { package: 'react-native-screens', licenseType: 'MIT' },
  { package: 'react-native-svg', licenseType: 'MIT' },
  { package: 'react-native-vector-icons', licenseType: 'MIT' },
  { package: 'viem', licenseType: 'MIT' },
];
