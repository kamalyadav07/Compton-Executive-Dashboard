import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Parse raw text supplied in user prompt containing Deal Won and Deal Lost datasets
const rawWonText = `ID	Stage	Company	Responsible	Deal Name	Source	Income	Created	End Date	Customer Category	Industry	Case Tag	Opportunity	Solution Type
4436	Deal Won	Mr Shadab	Taniya Negi	Mr. Shadab/ Delhi / Need a wifi 4MP Outdoor & indoor camera	Google Ads	26904	30-07-2026 17:55	30-07-2026 18:24	Gold	Personal + self		Need a wifi 4MP Outdoor & indoor camera	CCTV Solution
4418	Deal Won	Mr Tapesh Raghav	Sandeep Vahi	Mr Tapesh Raghav / Inder Puri / 2 Indoor Camera	Google Ads	7788	30-07-2026 12:23	30-07-2026 13:29	Silver	Personal + self		2 Indoor Camera	CCTV Solution
4412	Deal Won	MO Designs	Sandeep Vahi	MO Designs / Gurgaon / UPS Fan	Existing Client	3186	30-07-2026 11:07	30-07-2026 11:16	Gold	Others		UPS Fan	Others
4408	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Safe Ledger Pvt Ltd / Sec 32 , Gurgaon / Power Cable	Existing Client	826	30-07-2026 10:58	30-07-2026 11:18	Gold	Banking and Finance		Power Cable	Passive Networking solution
4402	Deal Won	fnb Packaging Private Limited	Rohit Yadav	fnb Packaging Private Limited / Ahmedabad / Passive material	Existing Client	6696.5	29-07-2026 17:38	29-07-2026 18:10	Gold	Others	Hot	Passive material	Passive Networking solution
4362	Deal Won	Mitsui Kinzoku	Sandeep Vahi	Mitsui Kinzoku / Bawal -rewari / 32 GB Ram	Existing Client	0	28-07-2026 12:00	28-07-2026 12:14	Gold	Others		32 GB Ram	Storage solution
4354	Deal Won	Can Ends India	Sandeep Vahi	Can Ends India / Delhi / Seqrite Endpoint Security License	Existing Client	76700	28-07-2026 10:41	28-07-2026 11:55	Gold	Others		Seqrite Endpoint Security License	Liscense
4352	Deal Won	Kommit	Taniya Negi	Kommit / F-12 , Jangpura Extension / Samsung Essential Monitor S3, 24-inch	Existing Client	25842	28-07-2026 10:29	29-07-2026 10:47	Gold	Legal		Samsung Essential Monitor S3, 24-inch	Desktops/ Laptops
4350	Deal Won	Heamon	Sandeep Vahi	Heamon / Aiims Data centre / AMC for PAC	Existing Client	1002294.36	27-07-2026 14:47	28-07-2026 11:51	Gold	Hospitality	Hot	AMC for PAC	Manage services Contract ( AMC)
4342	Deal Won	Amar Ujala Publication Ltd	Rohit Yadav	Amar Ujala Publication Ltd / Noida / Cable Manager	Existing Client	2619.6	27-07-2026 11:12	27-07-2026 11:32	Gold	Others		Cable Manager	Passive Networking solution
4338	Deal Won	fnb Packaging Private Limited	Rohit Yadav	fnb Packaging Private Limited / Ahmedabad / Conduit Pipe accessories	Existing Client	3776	27-07-2026 10:58	27-07-2026 11:11	Gold	Others	Hot	Conduit Pipe accessories	Passive Networking solution
4306	Deal Won	Singh & Singh	Taniya Negi	Singh & Singh / Defence Colony / HP ProBook 440 G11 (D9CU8PT)	Existing Client	259128	23-07-2026 11:52	25-07-2026 11:52	Gold	Others	Hot	HP ProBook 440 G11 (D9CU8PT)	Desktops/ Laptops
4286	Deal Won	Mr Arpit Residence	Rohit Yadav	Mr Arpit Residence/ GK-1 / Qubo CCTV camera	Existing Client	3549.99	21-07-2026 16:54	21-07-2026 17:30	Silver	Personal + self		Qubo CCTV camera	CCTV Solution
4094	Deal Won	Kommit	Taniya Negi	Kommit / F-12 , Jangpura Extension / TP-Link Archer AX23 AX1800	Existing Client	5310	18-07-2026 13:51	20-07-2026 13:02	Gold	Others	Warm	TP-Link Archer AX23 AX1800	Accessories
4070	Deal Won	true bhakti	Rohit Yadav	true bhakti / Mahipalpur / Service Charge	Existing Client	1475	18-07-2026 11:23	18-07-2026 11:34	Silver	Others		Service Charge	Services
4048	Deal Won	Singh & Singh	Taniya Negi	Singh & Singh / Defence Colony / Samsung Monitor & MS Office 2024	Existing Client	88382	16-07-2026 21:36	16-07-2026 22:05	Gold	Legal		Samsung Monitor & MS Office 2024	Desktops/ Laptops
4046	Deal Won	Mr Amit	Sandeep Vahi	Mr Amit / Delhi / CCTV	Google Ads	12744	16-07-2026 12:12	16-07-2026 23:00	Silver	Personal + self		CCTV	CCTV Solution
4032	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Meerut / Service Charge	Existing Client	3540	13-07-2026 13:09	13-07-2026 13:15	Gold	Banking and Finance		Service Charge	Services
4028	Deal Won	Kommit	Taniya Negi	Kommit / F-12 , Jangpura Extension / Sony TV (FW-55BZ30L)	Existing Client	57820	13-07-2026 12:45	13-07-2026 18:06	Gold	Legal	Hot	Sony TV (FW-55BZ30L)	Others
4024	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Safe Ledger Pvt Ltd / Gurgaon / Speakers	Existing Client	288627	13-07-2026 12:29	16-07-2026 22:27	Gold	Others	Warm	Speakers	Accessories
4020	Deal Won	IMTB ENGINEERS PVT LTD	Jitesh Chander	IMTB ENGINEERS PVT LTD / Greater Noida / Acer Veriton M200 Desktop.	Reference	118000	13-07-2026 12:18	16-07-2026 22:56	Gold	Others	Warm	Industrial-grade server PC.	Desktops/ Laptops
4010	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Sumerpur UR / Patch Cord	Existing Client	1150.5	13-07-2026 11:43	13-07-2026 11:56	Gold	Banking and Finance		Patch Cord	Accessories
4008	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Abu Road UR / Patch Cord	Existing Client	1150.5	13-07-2026 11:39	13-07-2026 11:57	Gold	Banking and Finance		Patch Cord	Accessories
4006	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Elamanchili / Patch Cord	Existing Client	1150.5	13-07-2026 11:35	13-07-2026 11:58	Gold	Banking and Finance		Patch Cord	Accessories
4004	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Bharuch / Patch Cord	Existing Client	1150.5	13-07-2026 11:27	13-07-2026 11:58	Gold	Banking and Finance		Patch Cord	Accessories
3994	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Elamanchili / CCTV Installation	Existing Client	42214.5	10-07-2026 11:42	10-07-2026 11:56	Gold	Banking and Finance		CCTV Installation	CCTV Solution
3992	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Bharuch / CCTV Installation	Existing Client	42214.5	10-07-2026 11:34	10-07-2026 12:02	Gold	Banking and Finance		CCTV Installation	CCTV Solution
3984	Deal Won	NCTE	Jitesh Chander	NCTE / Dwarka secter 10 / backup license renewal	Existing Client	159400.06	09-07-2026 14:28	10-07-2026 12:53	Silver	Education	Very Hot	backup license renewal	Liscense
3980	Deal Won	Dr. Prateek Gupta	Sandeep Vahi	Dr. Prateek Gupta / Hauz Khas / Patch Cord	Existing Client	885	09-07-2026 13:33	09-07-2026 13:40	Gold	Pharmaceutical		Patch Cord	Accessories
3978	Deal Won	Singh & Singh	Sandeep Vahi	Singh & Singh / Defence colony / Laptop	Existing Client	259128	09-07-2026 12:15	10-07-2026 11:53	Gold	Legal	Hot	Laptop	Desktops/ Laptops
3972	Deal Won	Abhinav kalla	Sandeep Vahi	Abhinav/ Bahadurgarh / Speakers for gaming PC	Existing Client	14160	08-07-2026 19:23	09-07-2026 11:17	Gold	Personal + self	Very Hot	Speakers for gaming PC	Accessories
3970	Deal Won	Singh & Singh	Sandeep Vahi	Singh & Singh / Defence colony / HP workstation	Existing Client	185260	08-07-2026 17:34	09-07-2026 16:25	Gold	Legal		HP workstation	Desktops/ Laptops
3964	Deal Won	Dr. Prateek Gupta	Sandeep Vahi	Dr. Prateek Gupta / Hauz Khas / Service Charge	Existing Client	1770	08-07-2026 13:45	08-07-2026 13:50	Gold	Pharmaceutical		Service Charge	Services
3956	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Sumerpur UR / CCTV setup	Existing Client	42598	08-07-2026 13:29	08-07-2026 13:44	Gold	Banking and Finance		CCTV setup	CCTV Solution
3954	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Abu Road UR / CCTV setup	Existing Client	42598	08-07-2026 12:58	08-07-2026 13:42	Gold	Banking and Finance		CCTV setup	CCTV Solution
3930	Deal Won	Abhinav kalla	Sandeep Vahi	Abhinav kalla/ Delhi / TP Link AX 1800 Wifi 6 , Bluetooth 5.2 PCLA Adaptop	Existing Client	3127	07-07-2026 13:28	07-07-2026 14:09	Silver	Personal + self		TP Link AX 1800 Wifi 6 , Bluetooth 5.2 PCLA Adaptop	Passive Networking solution
3926	Deal Won	Dr. Prateek Gupta	Sandeep Vahi	Dr. Prateek Gupta / Hauz Khas / Service Charge	Existing Client	3540	07-07-2026 11:42	07-07-2026 12:17	Gold	Others		Service Charge	CCTV Solution
3924	Deal Won	Medex India Pvt Ltd.	Taniya Negi	Medex India Pvt Ltd. / okhla / DDR4 RAM (16GB)	Existing Client	15163	06-07-2026 16:32	16-07-2026 22:19	Gold	Others		DDR4 RAM (8GB & 16GB)	Storage solution
3920	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Jaipur / CCTV Installation	Existing Client	9794	06-07-2026 16:13	06-07-2026 16:26	Gold	Banking and Finance		CCTV Installation	CCTV Solution
3914	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Registerkaro / Gurugram / PoE injector + Patch cord etc for 33 sec & 71 sec	Existing Client	50268	06-07-2026 13:02	06-07-2026 13:46	Gold	Banking and Finance		PoE injector + Patch cord etc for 33 sec & 71 sec	Passive Networking solution
3912	Deal Won	Roop Polymers Limited	Rohit Yadav	Roop Polymers Limited / Gurgaon / CCTV Monitoring	Existing Client	16402	06-07-2026 12:56	06-07-2026 13:38	Gold	Manufacturing		CCTV Monitoring	CCTV Solution
3908	Deal Won	Singh & Singh	Sandeep Vahi	Singh & Singh / Defence Colony / Need Apple MacBook Neo	Existing Client	581999.6	06-07-2026 11:35	08-07-2026 12:24	Gold	Legal		Need Apple MacBook Neo	Passive Networking solution
3892	Deal Won	Panacea Biotec Ltd.	Rohit Yadav	Panacea Biotec Ltd. / MALPUR / CCTV	Existing Client	12980	04-07-2026 10:36	04-07-2026 10:42	Gold	Pharmaceutical		CCTV	Passive Networking solution
3886	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / PAN india / 9 sites CCTV Surveillance	Existing Client	327096	03-07-2026 19:14	04-07-2026 11:56	Gold	Banking and Finance	Hot	CCTV Surveillance	CCTV Solution
3880	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Registerkaro / Gurgaon / Cable Manager	Existing Client	1593	02-07-2026 16:02	02-07-2026 16:12	Gold	Banking and Finance		Cable Manager	Passive Networking solution
3872	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Register Karo / Gurugram / Essl Solution	Existing Client	90972.4	01-07-2026 11:51	08-07-2026 12:16	Gold	Banking and Finance		essl ,vc solution ,jbl solution	Passive Networking solution
3870	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Registerkaro / Gurgaon / AP ...	Existing Client	153400	01-07-2026 10:35	01-07-2026 16:59	Gold	Banking and Finance		AP ... 4 units	Networking
3864	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Dehgam / 3 camera installation	Existing Client	3540	30-06-2026 12:40	30-06-2026 12:56	Gold	Banking and Finance	Hot	3 camera installation	CCTV Solution
3860	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Jaipur / CCTV 2 Nos	Existing Client	9794	30-06-2026 11:41	30-06-2026 12:17	Gold	Banking and Finance	Hot	CCTV 2 Nos	CCTV Solution
3858	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Nagaur/ Meerut/ Moradabad / CCTV Extension	Existing Client	15576	30-06-2026 11:37	30-06-2026 12:48	Gold	Banking and Finance	Very Hot	CCTV Extension	CCTV Solution
3840	Deal Won	Aga Khan Foundation	Jitesh Chander	Aga Khan Foundation / Lodhi Road / Microsoft 365 Business Basic Licenses	Existing Client	4602	29-06-2026 14:36	04-07-2026 11:18	Gold	Others		Microsoft 365 Business Basic Licenses	Liscense
3838	Deal Won	Jaya Shree Polymers	Jitesh Chander	Jayshree polymers / Manesar / Fibber up laying	Reference	343427.2	29-06-2026 11:28	16-07-2026 23:11	Gold	Others	Warm	Fiber uplaying	Passive Networking solution
3836	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Registerkaro / Gurgaon / Aruba AP 505/ JBL systems / Door Locks	Existing Client	191750	29-06-2026 10:57	29-06-2026 16:35	Gold	Banking and Finance		Aruba AP 505/ JBL systems / Door Locks	Networking
3826	Deal Won	AVSIS	Rohit Yadav	AVSIS / Noida / Firesafty Equipment Installation	India Mart	628350	26-06-2026 16:18	26-06-2026 17:26	Gold	Consulting	Hot	Firesafty Equipment Installation	Security
3822	Deal Won	Panacea Biotec Ltd.	Rohit Yadav	Panacea Biotec Ltd. / G3 New Delhi / Air purifier Filters	Existing Client	165200	26-06-2026 13:05	26-06-2026 13:27	Gold	Pharmaceutical	Hot	Air purifier Filters	Accessories
3814	Deal Won	Aga Khan Foundation	Jitesh Chander	Aga Khan Foundation / Lodhi Road / 22 antivirus licenses of Seqerite EPS	Existing Client	23104.4	25-06-2026 11:00	26-06-2026 17:28	Gold	Others		22 antivirus licenses of Seqerite EPS	Liscense
3810	Deal Won	ARA India Support Services Pvt Ltd	Sandeep Vahi	ARA India Support Services Pvt Ltd / Gurgaon / Networking Passive Items	Existing Client	6531.3	24-06-2026 11:24	24-06-2026 11:58	Gold	Others		Networking Passive Items	Passive Networking solution
3804	Deal Won	Abhinav kalla	Sandeep Vahi	Abhinav kalla/ Delhi / Gaming PC	Google Ads	190001.4	20-06-2026 19:32	26-06-2026 12:02	Gold	Personal + self	Hot	Gaming PC	Desktops/ Laptops
3772	Deal Won	Subh Exim	Jitesh Chander	Subh Exim / Kalka ji , Delhi / NVR & Service	Reference	3182.4	18-06-2026 14:44	18-06-2026 15:12	Silver	Others		NVR & Service	CCTV Solution
3756	Deal Won	Safe Ledger Pvt Ltd	Jitesh Chander	Registerkaro / Gurugram / CCTV solution	Google Ads	729676.6	17-06-2026 15:08	26-06-2026 12:05	Gold	Service	Warm	CCTV solution	CCTV Solution
3746	Deal Won	ARA India Support Services Pvt Ltd	Sandeep Vahi	ARA India/CCTV/ Gurgaon / CCTV	Google Ads	118000	16-06-2026 17:57	19-06-2026 17:11	Gold	Education		CCTV	CCTV Solution
3740	Deal Won	Mitsui Kinzoku	Taniya Negi	Mitsui Kinzoku / Gurgaon / Lapcare Battery	Existing Client	2183	16-06-2026 17:11	16-06-2026 17:21	Gold	Others		Lapcare Battery	Accessories
3738	Deal Won	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Manesar, Gurgaon, Haryana / Dell NAS AMC	Existing Client	94400	16-06-2026 14:33	24-06-2026 10:48	Gold	Manufacturing		Dell NAS AMC	Manage services Contract ( AMC)
3734	Deal Won	Campbell Scientific India	Jitesh Chander	Campbell Scientific India / Okhla / Panasonic Tough book	Existing Client	507400	16-06-2026 13:05	23-07-2026 11:28	Gold	Education		Desktop	Desktops/ Laptops
3728	Deal Won	The close North apartment owner association	Sandeep Vahi	The close North apartment owner association / Gurgaon / UPS	Reference	97350	15-06-2026 16:25	16-06-2026 11:32	Gold	Others	Very Hot	UPS	Power backup
3726	Deal Won	Syndicate Innovations International Ltd	Rohit Yadav	Syndicate Innovations International Ltd / Sahibabad / 2 TB HDD	Existing Client	14101	15-06-2026 13:03	16-06-2026 17:24	Gold	Others	Hot	2 TB HDD	Storage solution
3714	Deal Won	Panacea Biotec Ltd.	Rohit Yadav	Panacea Biotec Ltd. / BADDI / CCTV	Existing Client	12980	12-06-2026 12:48	12-06-2026 15:13	Gold	Pharmaceutical		CCTV	CCTV Solution
3708	Deal Won	Panacea Biotec Ltd.	Taniya Negi	Panacea Biotec Ltd. / Delhi / Fibre Patch cords	Existing Client	5900	11-06-2026 15:54	11-06-2026 17:24	Gold	Pharmaceutical	Warm	Fibre Patch cords	Passive Networking solution
3706	Deal Won	Syndicate Innovations International Ltd	Rohit Yadav	Syndicate Innovations International Ltd / Sahibabad / DVR & Camera	Existing Client	11977	11-06-2026 15:50	11-06-2026 16:53	Gold	Others	Hot	DVR & Camera	CCTV Solution
3700	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Phalodi , Jodhpur / CCTV Installation	Existing Client	40415	11-06-2026 12:44	11-06-2026 13:07	Gold	Banking and Finance		CCTV Installation	CCTV Solution
3686	Deal Won	Can Ends India	Rohit Yadav	Can Ends India / Delhi / EDR Demo and Sale	Existing Client	11210	10-06-2026 15:33	30-07-2026 18:12	Silver	Manufacturing	Warm	EDR Demo and Sale	Software
3672	Deal Won	Maninder Singh	Taniya Negi	Maninder Singh / White house / Consistent 512 SSD	Existing Client	6903	09-06-2026 12:35	09-06-2026 12:46	Gold	Legal		Consistent 512 SSD	Storage solution
3670	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Hyderabad / CCTV	Existing Client	270279	08-06-2026 20:14	27-06-2026 12:49	Gold	Service		CCTV	CCTV Solution
3650	Deal Won	Panacea biotech ltd	Rohit Yadav	Panacea Baddi / Baddi / Network AMC	Existing Client	737500	21-02-2026 15:47	08-06-2026 11:21	Gold	Pharmaceutical	Warm	Network AMC	Manage services Contract ( AMC)
3646	Deal Won	Blind Relief Association	Jitesh Chander	Blind Relief Association / Lodhi Road / New Building AMC	Existing Client	29500	08-06-2026 10:38	25-06-2026 11:11	Gold	Others	Warm	New Building AMC	Manage services Contract ( AMC)
3636	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / KAKINADA, Andhra Pradesh / Patch Cord	Existing Client	1150.5	06-06-2026 18:38	06-06-2026 18:48	Gold	Banking and Finance		Patch Cord	Passive Networking solution
3634	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Baran, Rajasthan / Patch Cord	Existing Client	1150.5	06-06-2026 18:37	06-06-2026 18:41	Gold	Banking and Finance		Patch Cord	Passive Networking solution
3632	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Balotra, Rajasthan / Patch Cord	Existing Client	1150.5	06-06-2026 18:32	06-06-2026 18:45	Gold	Banking and Finance		Patch Cord	Passive Networking solution
3616	Deal Won	TIB retail pvt ltd	Taniya Negi	TIB retail pvt ltd / Noida / Dell Monitor	Existing Client	8555	06-06-2026 14:11	06-06-2026 14:47	Gold	Manufacturing	Very Hot	Dell Monitor	Accessories
3612	Deal Won	Maninder Singh	Taniya Negi	Maninder Singh / White house / POE Injector	Existing Client	1711	06-06-2026 10:46	06-06-2026 10:55	Gold	Legal		POE Injector	Passive Networking solution
3604	Deal Won	TIB retail pvt ltd	Taniya Negi	TIB retail pvt ltd / Noida / Monitor & Storage Upgrade	Existing Client	29862.26	05-06-2026 17:36	05-06-2026 18:18	Gold	Manufacturing	Very Hot	Monitor & Storage Upgrade	Accessories
3590	Deal Won	Syndicate Innovations International Ltd	Taniya Negi	Syndicate Innovations International Ltd / Sahibabad / Dvr cell & Service	Existing Client	2124	03-06-2026 16:44	03-06-2026 17:49	Gold	Others		Dvr cell & Service	Services
3586	Deal Won	Mitsui Kinzoku	Jitesh Chander	Mitsui Kinzoku / Gurgaon / HP 240R G10 Business Laptop	Existing Client	176823	03-06-2026 12:27	18-06-2026 18:22	Gold	Manufacturing	Warm	HP 240R G10 Business Laptop	Desktops/ Laptops
3576	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Rajkot / Surveillance Sites-Capri Global	Existing Client	252094.02	02-06-2026 18:49	10-07-2026 11:25	Gold	Banking and Finance	Warm	Surveillance Sites-Capri Global	CCTV Solution
3574	Deal Won	Singh & Singh	Rohit Yadav	Singh & Singh / Defence colony / NAS Required for CCTV backup	Existing Client	118944	02-06-2026 18:47	04-07-2026 13:29	Gold	Legal	Hot	NAS Required for CCTV backup	Storage solution
3550	Deal Won	Alpha MilkFoods PVT. LTD.	Jitesh Chander	Alpha MilkFoods Pvt. Ltd. / Okhla / Microsoft Automate License	Google Ads	158710	30-05-2026 14:33	01-06-2026 10:31	Gold	Others	Hot	Microsoft Automate License	Liscense
3546	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Telengana / Cat 6 Cable Laying	Existing Client	8260	30-05-2026 13:35	30-05-2026 13:39	Gold	Others		Cat 6 Cable Laying	Passive Networking solution
3538	Deal Won	SPSS Mediline LLP	Taniya Negi	SPSS Mediline LLP / Okhla Phase 2 / Network Device	Existing Client	28523.6	27-05-2026 17:43	28-05-2026 14:53	Silver	Manufacturing		Network Device	Networking
3530	Deal Won	Campbell Scientific India	Jitesh Chander	Campbell Scientific India / Okhla / HP ProBook 440 G9 Laptop	Existing Client	80535	27-05-2026 13:44	27-05-2026 15:22	Gold	Others	Hot	HP ProBook 440 G9 Laptop	Desktops/ Laptops
3526	Deal Won	DJJS	Taniya Negi	DJJS / Nurmahal / Lock	Existing Client	2950	26-05-2026 16:29	27-05-2026 15:27	Gold	Others	Hot	Lock	Security
3522	Deal Won	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Behrampur / QN-I-270 (Quantum AP)	Existing Client	36726.32	26-05-2026 11:25	16-06-2026 11:14	Gold	Others	Warm	QN-I-270 (Quantum AP)	Networking
3520	Deal Won	Dinamic Oil	Rohit Yadav	Dinamic Oil / Yakubpur / CCTV Material	Existing Client	122607.31	26-05-2026 10:54	31-05-2026 16:07	Platinum	Manufacturing		CCTV Material	CCTV Solution
3504	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Ahmedabad / CCTV Installation	Existing Client	2802.5	23-05-2026 14:08	25-05-2026 17:39	Gold	Banking and Finance	Hot	CCTV Installation	CCTV Solution
3502	Deal Won	Akshay Patra Foundation	Rohit Yadav	Akshay Patra Foundation / agra /Raigarh / Solar based camera	Existing Client	42600.36	22-05-2026 19:21	02-06-2026 18:53	Gold	Infrastructure Development	Warm	Solar based camera	CCTV Solution
3490	Deal Won	Mitsui Kinzoku	Taniya Negi	Mitsui Kinzoku / Bawal / HP Laptop	Existing Client	51774.86	22-05-2026 12:49	22-05-2026 12:58	Gold	Others	Hot	HP 240R G9 Laptop	Desktops/ Laptops
3478	Deal Won	Panacea Biotec Ltd.	Rohit Yadav	Panacea Biotec Ltd. / Lalru / Cat-7 cable	Existing Client	47200	21-05-2026 18:40	22-05-2026 11:56	Gold	Pharmaceutical	Hot	Cat-7 cable	Passive Networking solution
3468	Deal Won	TIB retail pvt ltd	Taniya Negi	TIB retail pvt ltd / Greater Noida / Desktop , laptop and some other hardware items	Existing Client	6914.8	21-05-2026 11:53	22-05-2026 12:38	Gold	Others	Hot	Desktop , laptop and some other hardware items	Desktops/ Laptops
3462	Deal Won	SPSS Mediline LLP	Taniya Negi	SPSS Mediline LLP / Okhla Phase 2 / Network Device	Existing Client	25724	20-05-2026 17:15	22-05-2026 12:11	Silver	Manufacturing		Network Device	Networking
3460	Deal Won	Schueco India	Sandeep Vahi	Schueco India / Noida / IVR Solution	Existing Client	300900	20-05-2026 13:20	21-07-2026 17:12	Gold	Others	Warm	IVR Solution	Others
3454	Deal Won	Ishaan George	Taniya Negi	Ishaan George / Defence colony / Security solution	Reference	43612.8	19-05-2026 19:38	27-05-2026 16:05	Gold	Legal	Very Hot	Security solution	Security
3440	Deal Won	TIB retail pvt ltd	Sandeep Vahi	TIB retail pvt ltd / Greater Noida / RAM Upgradation	Existing Client	132750	18-05-2026 14:00	12-06-2026 16:17	Gold	Manufacturing	Very Hot	RAM Upgradation	Storage solution
3438	Deal Won	Syndicate Innovations International Ltd	Rohit Yadav	Syndicate Innovations / Ghaziabad / 12V + 5A Adaptor	Existing Client	1121	18-05-2026 13:19	31-05-2026 22:11	Gold	Others		12V + 5A Adaptor	Accessories
3414	Deal Won	Maninder Singh	Taniya Negi	Jagdish / West Vinod Nagar, Delhi / Laptop HP Elite	Existing Client	72500	15-05-2026 13:22	15-05-2026 13:35	Gold	Consulting	Hot	Laptop	Desktops/ Laptops
3404	Deal Won	Singh & Singh	Taniya Negi	Singh & Singh / Defence Colony / Wire Shifting Charge	Existing Client	2360	15-05-2026 12:26	15-05-2026 12:33	Gold	Legal		Wire Shifting Charge	Services
3402	Deal Won	Maninder Singh	Sandeep Vahi	Maninder Singh / White house / Server repair	Existing Client	54870	15-05-2026 11:57	15-05-2026 14:25	Gold	Legal	Very Hot	Server repair	Services
3356	Deal Won	Syndicate Innovations International Ltd	Rohit Yadav	Syndicate Innovations / Ghaziabad / NVR & Camera Not working Service	Existing Client	1770	13-05-2026 11:12	13-05-2026 11:22	Gold	Others		NVR & Camera Not working Service	Services
3344	Deal Won	Rashmi Fashions	Taniya Negi	Rashmi Fashions / Noida / Domain Renewal Charges – For Three Years	Existing Client	9617	12-05-2026 14:36	12-05-2026 15:20	Gold	Others	Hot	Domain Renewal Charges – For Three Years	Software
3342	Deal Won	Mitsui Kinzoku	Jitesh Chander	Mitsui Kinzoku / Bawal / Laptop /Desktop	Existing Client	158120	12-05-2026 12:02	20-05-2026 11:01	Gold	Others		Laptop /Desktop	Desktops/ Laptops
3334	Deal Won	Wow Momo Foods Pvt.Ltd	Taniya Negi	Wow Momo Foods Pvt.Ltd / Bengaluru 30 Sites / Preventive Maintenance	Existing Client	42480	11-05-2026 16:50	11-05-2026 17:06	Gold	Food and Bevearges		Preventive Maintenance	Manage services Contract ( AMC)
3320	Deal Won	MO Designs	Taniya Negi	MO Designs / Gurgaon / DDR3 RAM	Existing Client	4366	11-05-2026 11:06	11-05-2026 15:19	Gold	Others	Warm	DDR3 RAM	Storage solution
3310	Deal Won	Campbell Scientific India	Jitesh Chander	Campbell Scientific India / Okhla / sophos firewall	Existing Client	212400	08-05-2026 12:50	30-05-2026 13:32	Gold	Manufacturing		sophos firewall	Security
3306	Deal Won	Amar Ujala Publication Ltd	Jitesh Chander	Amar Ujala Publication Ltd / Sec-62, Noida / Required server racks dressing & services	Self Generated	55578	07-05-2026 15:05	16-07-2026 22:15	Gold	Entertainment	Warm	Required server racks dressing & services	Passive Networking solution
3302	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Baran, Rajasthan / CCTV Installation	Existing Client	38232	07-05-2026 11:27	11-05-2026 10:33	Gold	Others		CCTV Installation	CCTV Solution
3300	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / KAKINADA, Andhra Pradesh / CCTV Installation	Existing Client	38232	07-05-2026 11:24	11-05-2026 10:36	Gold	Others		CCTV Installation	CCTV Solution
3298	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Balotra, Rajasthan / CCTV Installation	Existing Client	38232	07-05-2026 11:15	07-05-2026 13:14	Gold	Banking and Finance		CCTV Installation	CCTV Solution
3256	Deal Won	Panacea biotech ltd	Taniya Negi	Panacea biotech ltd / Baddi / D-Sub 9 pin Cable	Existing Client	1121	05-05-2026 16:25	06-05-2026 12:15	Gold	Others		D-Sub 9 pin Cable	Accessories
3252	Deal Won	Medex India Pvt Ltd.	Jitesh Chander	Medex India Pvt Ltd. / Okhla Phase 1 / 8 GB Ram For desktop upgrade	Existing Client	4350	05-05-2026 13:27	05-05-2026 17:40	Gold	Pharmaceutical		8 GB Ram For desktop upgrade	Storage solution
3206	Deal Won	Dr. Prateek Gupta	Sandeep Vahi	Dr. Prateek Gupta / Hauz Khas/Network Switch and installation	Existing Client	88500	04-05-2026 10:35	04-05-2026 13:43	Gold	Hospital		Network Switch and installation	Networking
3194	Deal Won	Singh & Singh	Jitesh Chander	Singh & Singh / Defence Colony / CCTV Setup	Existing Client	313686.48	02-05-2026 17:53	25-05-2026 15:49	Gold	Consulting	Warm	CCTV Setup	CCTV Solution
3184	Deal Won	Capri Global Capital Limited	Taniya Negi	Capri Global Capital Limited / Chennai / Patch Cord	Existing Client	1150.5	01-05-2026 18:07	01-05-2026 18:15	Gold	Others		Patch Cord	Passive Networking solution
3182	Deal Won	Capri Global Capital Limited	Taniya Negi	Capri Global Capital Limited / Hoskote / Patch Cord	Existing Client	1150.5	01-05-2026 18:03	01-05-2026 18:17	Gold	Others		Patch Cord	Passive Networking solution
3180	Deal Won	Capri Global Capital Limited	Taniya Negi	Capri Global Capital Limited / Indore / Patch Cord	Existing Client	1150.5	01-05-2026 17:43	01-05-2026 18:20	Gold	Others		Patch Cord	Passive Networking solution
3168	Deal Won	Kommit	Taniya Negi	Kommit / F-12 , Jangpura Extension , New Delhi-110014 / Hp Laptop Charger	Existing Client	1475	01-05-2026 13:41	01-05-2026 13:52	Gold	Others		Hp Laptop Charger	Accessories
3146	Deal Won	fnb Packaging Private Limited	Rohit Yadav	Can Ends India / Ahmedabad / Residence IT Work	Existing Client	371316.5	30-04-2026 18:52	04-07-2026 12:39	Gold	Others		Residence IT Work	Passive Networking solution
3144	Deal Won	Panacea biotech ltd	Rohit Yadav	Panacea biotech ltd / Delhi / DC AMC	Existing Client	181366	30-04-2026 18:50	12-06-2026 15:17	Gold	Manufacturing	Warm	DC AMC	Manage services Contract ( AMC)
3142	Deal Won	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Bhopal / CCTV Surveillance	Existing Client	140951	30-04-2026 18:47	09-07-2026 12:02	Gold	Banking and Finance	Hot	CCTV Surveillance	CCTV Solution
3070	Deal Won	EBSCO	Jitesh Chander	EBSCO / Bhikaji Cama place / Rodent solution	Existing Client	108619	24-04-2026 14:29	31-05-2026 22:45	Gold	Others	Hot	Rodent solution	Services
3050	Deal Won	TIB retail pvt ltd	Jitesh Chander	TIB retail pvt ltd / Greater noida / HP workstation	Reference	316240	22-04-2026 15:47	04-05-2026 13:45	Gold	Consulting	Hot	HP workstation	Desktops/ Laptops
3010	Deal Won	Singh & Singh	Jitesh Chander	Singh & Singh / Defence Colony / Mobile Booster	Existing Client	249570	20-04-2026 12:52	01-05-2026 13:14	Gold	Manufacturing	Warm	Mobile Booster	Networking
2994	Deal Won	Roop India	Jitesh Chander	Roop India / Manesar / Quantam Ap	Existing Client	49560	18-04-2026 14:42	11-05-2026 17:03	Gold	Others		Quantam Ap	Networking
2870	Deal Won	Schueco India	Taniya Negi	Schueco India / Noida / Polystudio E70 Remote	Existing Client	7434	03-04-2026 13:31	22-05-2026 11:54	Gold	Manufacturing	Hot	Polystudio E70 Remote	Accessories
2830	Deal Won	Maninder Singh	Rohit Yadav	Maninder Singh- White House/ Sundar Nagar / Office renovate	Existing Client	732644.3	27-03-2026 15:35	11-06-2026 14:44	Gold	Consulting	Warm	Office renovate	Services
2780	Deal Won	Singh & Singh	Jitesh Chander	Singh & Singh / Defence Colony / QNAP NAS Storage	Existing Client	471970.5	25-03-2026 13:19	30-06-2026 11:03	Gold	Manufacturing	Warm	QNAP NAS Storage	Storage solution`;

const rawLostText = `ID	Stage	Company	Responsible	Deal Name	Source	Income	Created	End Date	Deal Lost Reason	Industry	Case Tag	Opportunity	Solution Type
4428	Deal lost	Maninder Singh	Rohit Yadav	Arpit Singh Arora / N-16 / Memory card	Existing Client	4720	30-07-2026 13:52	30-07-2026 18:25	No Requirement	Legal	Hot	Memory card	Storage solution
4358	Deal lost	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Maneser / Need CipherLab RS36 Mobile Computer Battery	Existing Client	13500	28-07-2026 11:53	28-07-2026 11:55	Price Challenge	Manufacturing	Hot	Need CipherLab RS36 Mobile Computer Battery	Services
4344	Deal lost	Innovision limited	Sandeep Vahi	Innovision limited / Delhi / Need a workstations	Existing Client	8000000	27-07-2026 11:28	29-07-2026 13:35	Price Challenge	Services	Hot	Need a workstations	Services
4326	Deal lost	H.G. Infra Engineering Ltd.	Jitesh Chander	H.G. Infra Engineering Ltd. / New Delhi / Need Ubiquiti & Alternative 360° Wireless Devices	Google Ads	84252	25-07-2026 15:29	27-07-2026 10:43	Price Challenge	Manufacturing	Hot	Need Ubiquiti Wireless Devices	Networking
4302	Deal lost	Campbell Scientific India	Jitesh Chander	Campbell Scientific India / Okhla / Panasonic Fully Toughpad	Existing Client	215000	23-07-2026 10:58	23-07-2026 11:34	Double Entry	Education	Hot	Panasonic Fully Toughpad	Tablets
4294	Deal lost	Ravi	Taniya Negi	Ravi / Greater Noida / 3 Camera IP Solution , 15 days recording	Google Ads	45000	22-07-2026 17:59	27-07-2026 17:32	No requirement	Others	Warm	3 Camera IP Solution	CCTV Solution
4292	Deal lost	Bhavya Enterprises	Taniya Negi	Bhavya Enterprises / Mathura / 5MP HD Camera	Google Ads	38000	22-07-2026 17:02	27-07-2026 16:32	Prices were too high	Retail	Warm	5MP HD Camera	CCTV Solution
4282	Deal lost	Campbell Scientific India	Jitesh Chander	Campbell Scientific India / Okhla / DEll Desk Top	Existing Client	145000	21-07-2026 12:37	27-07-2026 11:41	Case hold from Customer side	Education	Hot	DEll Desk Top	Desktops/ Laptops
4092	Deal lost	Medex India Pvt Ltd.	Taniya Negi	Medex India Pvt Ltd. / Okhla / 8GB RAM for Desktop	Existing Client	8500	18-07-2026 13:15	21-07-2026 11:05	Price challenge	Others	Warm	8GB RAM for Desktop	Storage solution
4090	Deal lost	Vishal	Taniya Negi	Mr. Vishal /Greater Noida/Need CCTV 4-5 Camera installation	Google Ads	42000	18-07-2026 13:02	24-07-2026 16:02	Taken from somewhere else	Personal + self	Warm	CCTV 4-5 Camera installation	CCTV Solution
4086	Deal lost	Ajeet	Taniya Negi	Mr. Ajeet /Need 6 camera for his unit in bhalabgarh	Google Ads	58000	18-07-2026 12:58	24-07-2026 16:01	Proposed prices were high & slow turnaround	Consulting	Warm	Need 6 camera for unit	CCTV Solution
4080	Deal lost	Roop India	Jitesh Chander	Roop India / Manesar / AMC for all Quantum Access points	Existing Client	185000	18-07-2026 12:15	27-07-2026 11:54	Management not agree	Manufacturing	Hot	AMC for Quantum AP	Manage services Contract ( AMC)
4078	Deal lost	Shikha	Taniya Negi	Shikha / delhi / CCTV	Google Ads	19470	18-07-2026 12:03	25-07-2026 13:17	Purchased from somewhere else	Personal + self	Hot	CCTV	CCTV Solution
4076	Deal lost	V.K Singh	Taniya Negi	Mr. V.K Singh /Need 3 camera for Home	Google Ads	32000	18-07-2026 11:52	27-07-2026 17:27	Took too long to submit quotation	Personal + self	Warm	Need 3 camera for Home	CCTV Solution
4074	Deal lost	SUBIRA DESSERTS PRIVATE LIMITED	Sandeep Vahi	SUBIRA DESSERTS PRIVATE LIMITED / CCTV	Google Ads	65000	18-07-2026 11:35	23-07-2026 14:34	Prices high	Restaurants	Warm	CCTV	CCTV Solution
4068	Deal lost	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Manesar / Ap Quantam	Existing Client	95000	17-07-2026 18:22	23-07-2026 11:00	Price challenge	Manufacturing	Hot	Ap Quantam	Networking
4066	Deal lost	Roop Polymers Limited	Sandeep Vahi	Roop Polymers Limited / Manesar / ACCESS POINT	Existing Client	78000	17-07-2026 15:20	24-07-2026 13:44	Pricing issue	Manufacturing	Hot	ACCESS POINT	Accessories
4044	Deal lost	S K sharma	Taniya Negi	S K sharma / Delhi / need 4-5 cameras for home	Google Ads	48000	15-07-2026 14:07	27-07-2026 10:34	Purchased from somewhere else	Personal + self	Warm	need 4-5 cameras for home	CCTV Solution
4042	Deal lost	Ane Industries	Sandeep Vahi	Ane Industries / Gurgaon / Ajax Smart Security System	Existing Client	165000	15-07-2026 11:12	21-07-2026 17:27	Customer dropped idea	Manufacturing	Hot	Ajax Smart Security System	Accessories
4040	Deal lost	Personal use	Taniya Negi	Poonam/Personal use / Narela / CCTV	Google Ads	37000	13-07-2026 19:02	25-07-2026 13:01	Not required	Personal + self	Warm	CCTV	CCTV Solution
4036	Deal lost	Aman Kumar	Jitesh Chander	Aman Kumar / Noida / Required server racks dressing & services	Reference	49500	13-07-2026 14:26	21-07-2026 12:49	Management not agree	Others	Warm	Server racks dressing	Services
4022	Deal lost	Medex India Pvt Ltd.	Jitesh Chander	Medex India Pvt Ltd. / Okhla / Microsoft Office Home Edition 2024 License	Existing Client	18500	13-07-2026 12:20	23-07-2026 11:00	Price challenge	Others	Warm	Microsoft Office License	Liscense
3948	Deal lost	Aga Khan Foundation	Jitesh Chander	Aga Khan Foundation / Lodhi Road / Asus Laptop	Existing Client	98000	08-07-2026 10:57	13-07-2026 13:31	Price Challenge	Education	Hot	Asus Laptop	Desktops/ Laptops
3942	Deal lost	CP Plus	Taniya Negi	CP Plus / Greater Noida / CCTV	Google Ads	54000	07-07-2026 18:09	25-07-2026 12:58	Purchased from somewhere else	Personal + self	Warm	CCTV	CCTV Solution
3940	Deal lost	ARB Accessories Pvt Ltd	Taniya Negi	ARB Accessories Pvt Ltd / Noida / CCTV	Google Ads	125000	07-07-2026 17:41	24-07-2026 17:43	Purchased from somewhere else	Manufacturing	Cold	CCTV	CCTV Solution
3938	Deal lost	MeaTech Solutions LLP	Jitesh Chander	MeaTech Solutions LLP / Gurgaon / CCTV	Google Ads	86000	07-07-2026 17:02	21-07-2026 11:39	Price Challenge	Others	Warm	CCTV	CCTV Solution
3884	Deal lost	Nestle India Limited	Jitesh Chander	Nestle India Limited / Sonipat / CCTV surveillance	Existing Client	480000	03-07-2026 15:19	08-07-2026 13:16	Competitor selected	Food and Bevearges	Hot	CCTV surveillance	CCTV Solution
3878	Deal lost	Lal & Sethi	Jitesh Chander	Lal & Sethi / South Ext / Manpower for 2 days	Existing Client	20000	02-07-2026 12:28	13-07-2026 13:29	Price Challenge	Legal	Hot	Manpower for 2 days	Services
3842	Deal lost	ARA India Support Services	Sandeep Vahi	ARA India Support Services / Gurgaon / Networking Items	Existing Client	150000	29-06-2026 14:38	03-07-2026 11:01	Price was high	Others	Hot	Networking Items	Passive Networking solution
3798	Deal lost	Aerodronerobotics	Sandeep Vahi	Aerodronerobotics / Gurgaon / PTZ Cameras - 4	Google Ads	613600	20-06-2026 14:08	29-06-2026 12:09	No control on reseller case	Service	Warm	PTZ Cameras - 4	CCTV Solution
3790	Deal lost	Suvansh	Tausif Ahmad	Suvansh / Sonepat / CCTV Installation	Google Ads	66316	20-06-2026 14:01	29-06-2026 14:48	Prices too high	Others	Warm	CCTV Installation	CCTV Solution
3784	Deal lost	Mitsui Kinzoku	Jitesh Chander	Mitsui Kinzoku / Haryana / Laptop bag	Existing Client	3186	19-06-2026 18:18	24-07-2026 15:26	Price issue	Manufacturing	Hot	Laptop bag	Accessories
3766	Deal lost	LA SWISS CHOCOLAT	Tausif Ahmad	LA SWISS CHOCOLAT / Noida / HP Desktop Computer	Self Generated	68000	18-06-2026 11:04	18-06-2026 11:10	Submitted late quote	Food and Bevearges	Warm	HP Desktop Computer	Desktops/ Laptops
3764	Deal lost	Roop Koepp Foam Technologies	Jitesh Chander	Roop Koepp Foam / Manesar / Dell Storage for Pune Office	Existing Client	46392	18-06-2026 10:47	27-07-2026 13:16	Management not agree	IT	Warm	Dell Storage for Pune Office	Storage solution
3760	Deal lost	Capri Global Capital Limited	Rohit Yadav	Capri Global Capital Limited / Delhi / UPS batteries installation	Existing Client	124000	17-06-2026 17:54	23-07-2026 13:03	Dropped by customer	Banking and Finance	Hot	UPS batteries installation	Power backup
3758	Deal lost	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Manesar / Audit of data center Fire Cylinder	Existing Client	9440	17-06-2026 15:19	13-07-2026 13:30	Price Challenge	Manufacturing	Hot	Audit Fire Cylinder	Services
3752	Deal lost	IHP	Tausif Ahmad	IHP / DELHI / CCTV solution	Google Ads	210000	17-06-2026 14:40	29-06-2026 15:49	No site visit by rep	Manufacturing	Warm	CCTV solution	CCTV Solution
3716	Deal lost	Billplan fintech	Sandeep Vahi	Billplan / Nehru place / Networking and IT Infra	Reference	510591	12-06-2026 14:53	29-06-2026 12:14	Lost to competition due to price	Service	Hot	Networking and IT Infra	Passive Networking solution
3664	Deal lost	Barry Callebaut	Rohit Yadav	Barry Callebaut / Baramati / IT Networking	Existing Client	1422700	08-06-2026 17:53	27-07-2026 13:39	Customer preferred competition	Manufacturing	Hot	IT Networking	Passive Networking solution
3643	Deal lost	Barry Callebaut	Rohit Yadav	Barry Caulbaut Baramati-Pune / E-surveillance project	Reference	4733605	07-06-2026 23:46	27-07-2026 13:40	Customer preferred competition	Food and Bevearges	Hot	E-surveillance project	CCTV Solution
3584	Deal lost	V Mart	Jitesh Chander	V Mart / Gurgaon / Lenovo Desktop i7 14 Gen	Reference	1227200	03-06-2026 11:41	20-06-2026 12:52	Management not agree	Retail	Warm	Lenovo Desktop i7 14 Gen	Desktops/ Laptops
3464	Deal lost	Roop Polymers Limited	Jitesh Chander	Roop Polymers Limited / Manesar / HP 280 G9 Desktop	Existing Client	194243	21-05-2026 10:56	13-07-2026 13:28	Price Challenge	Manufacturing	Warm	HP 280 G9 Desktop	Desktops/ Laptops
3452	Deal lost	Salwan Junior School	Jitesh Chander	Salwan Junior School / Naraina, Delhi / CCTV with PA system	Google Ads	690405	19-05-2026 18:25	17-07-2026 17:50	Idea Postponed	Education	Hot	CCTV with PA system	CCTV Solution
3448	Deal lost	Westend Heights Association	Jitesh Chander	Westend Heights / DLF Phase 5, Gurgaon / CCTV	Google Ads	1941340	19-05-2026 14:11	26-06-2026 11:25	Price challenge	Real Estate	Hot	CCTV	CCTV Solution
3408	Deal lost	Hyosung TNS Ind Pvt Ltd	Ashok Kumar	Hyosung TNS Ind Pvt Ltd / Mumbai / VC Solution	Google Ads	761000	15-05-2026 12:33	20-06-2026 13:14	Cold response from customer	Infrastructure Development	Hot	VC Solution	Video Conferencing
3394	Deal lost	Raygain Technologies	Jitesh Chander	Raygain Technologies / Safardarjung Enclave / AI IP Solution	Google Ads	1475649	14-05-2026 19:49	29-05-2026 11:08	System integrator price check	IT	Warm	AI-based IP CCTV	CCTV Solution`;

function tsvToJson(tsvText) {
  const lines = tsvText.trim().split('\n');
  const headers = lines[0].split('\t');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 3) continue;

    const rowObj = {};
    headers.forEach((h, idx) => {
      let val = parts[idx] ? parts[idx].trim() : '';
      if (h === 'Income') val = parseFloat(val) || 0;
      rowObj[h] = val;
    });

    rows.push(rowObj);
  }

  return rows;
}

// REAL IN-PROGRESS STAGES requested by user:
// 1. Need Analysis
// 2. Solution Design
// 3. Solution Approval
// 4. Quote Creation
// 5. Quotation Approval
// 6. Negotiation
const realInProgressStages = [
  'Need Analysis',
  'Solution Design',
  'Solution Approval',
  'Quote Creation',
  'Quotation Approval',
  'Negotiation'
];

function processAndSave() {
  const wonData = tsvToJson(rawWonText);
  const lostData = tsvToJson(rawLostText);

  // Derive in progress dataset with exact 6 user stages
  const progressData = wonData.slice(0, 48).map((r, idx) => ({
    ...r,
    ID: `4500${idx}`,
    Stage: realInProgressStages[idx % realInProgressStages.length],
    Income: Math.round(r.Income * 1.2) || 150000
  }));

  const outputDirs = ["public/sample_data", "."];

  outputDirs.forEach(outputDir => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const wbWon = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbWon, XLSX.utils.json_to_sheet(wonData), "Won Deals");
    XLSX.writeFile(wbWon, path.join(outputDir, "Won Deals.xlsx"));

    const wbLost = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbLost, XLSX.utils.json_to_sheet(lostData), "Lost Deals");
    XLSX.writeFile(wbLost, path.join(outputDir, "Lost Deals.xlsx"));

    const wbProgress = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbProgress, XLSX.utils.json_to_sheet(progressData), "In Progress Deals");
    XLSX.writeFile(wbProgress, path.join(outputDir, "In Progress Deals.xlsx"));

    console.log(`Successfully generated Won Deals (${wonData.length} records), Lost Deals (${lostData.length} records), and In Progress Deals (${progressData.length} records) with real stages in ${outputDir}`);
  });
}

processAndSave();
