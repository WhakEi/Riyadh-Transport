import tkinter as tk
from tkinter import ttk
from PIL import ImageTk, Image
import urllib.request
import io

bus_routes = {
    "Bus 9": [
        "Transportation Center A", "Al Batha 210", "Al Batha 208", "Al Batha 207", "Al Batha 206", "Al Batha 205", "Al Batha 204", "Al Batha 202", "Al Batha 201", "Al-Muraba 610", "Al-Muraba 609", "Al-Muraba 607", "Al-Muraba 606", "Al-Muraba 605", "Al-Olaya 613", "Olaya 218", "Olaya 217", "Olaya 216", "Olaya 215", "Olaya 212", "Olaya 211", "Olaya 210", "Olaya 209", "Olaya 208", "Olaya 207", "Olaya 206", "Al-Mughera Bin Shoubah 101", "Al-Murooj 602", "Olaya 106", "Olaya 107", "Olaya 108", "Olaya 109", "Olaya 110", "Olaya 111", "Olaya 113", "Olaya 114", "Olaya 116", "Olaya 117", "Olaya 118", "Al-Olaya 512", "Al-Olaya 513", "Al-Muraba 505", "Al-Muraba 506", "Al-Muraba 508", "Al-Muraba 510"," Al Batha 101"," Al Batha 102"," Al Batha 104"," Al Batha 105"," Al Batha 106"," Al Batha 107"," Al Batha 108"," Al Batha 109", "Transportation Center A"
    ],
    "Bus 7": [
        'Transportation Center A', 'Al Batha 210', 'Al Batha 208', 'Al Batha 207', 'Al Batha 206', 'Al Batha 205', 'Al Batha 204', 'Al Batha 202', 'Al Batha 201', 'Al-Muraba 610', 'Al Washm 401', 'An-Namuthajiyah 603', 'An-Namuthajiyah 602', 'King Saud 401', 'An-Nasiriyah 601', 'Ash-Sharafiyah 604', 'Ash-Sharafiyah 603', 'Ash-Sharafiyah 602', 'Ash-Sharafiyah 601', 'King Khalid 206', 'King Khalid 205', 'King Khalid 204', 'King Khalid 203', 'Umm Al Hamam 208', 'Umm Al Hamam 207', 'Umm Al Hamam 206', 'Umm Al Hamam 205', 'Umm Al Hamam 204', 'Umm Al Hamam 203',' Umm Al Hamam 202',' Umm Al Hamam 201',' Al Urubah 404',' Al Urubah 403',' Al Urubah 401', 'King Khalid 101',' Al Urubah302',' Al Urubah303',' Umm Al Hamam101',' Umm Al Hamam102',' Umm Al Hamam103',' Umm Al Hamam104',' Umm Al Hamam105',' Umm Al Hamam106',' Umm Al Hamam107',' Umm Al Hamam108',' King Khalid 103',' King Khalid 104',' King Khalid 105',' King Khalid 106',' Ash-Sharafiyah 501',' Ash-Sharafiyah 502',' Ash-Sharafiyah 503',' Ash-Sharafiyah 504',' An-Nasiriyah 501',' An-Nasiriyah 502',' King Saud 301',' An-Namuthajiyah 501',' An-Namuthajiyah 503',' Al Washm 301',' Al-Muraba 510',' Al Batha 101',' Al Batha 102',' Al Batha 104',' Al Batha 105',' Al Batha 106',' Al Batha 107',' Al Batha 108', 'Transportation Center A'
    ],
    "Bus 8": [
        'Al Batha 201', 'Al-Muraba 610', 'Al Washm 401', 'An-Namuthajiyah 603', 'An-Namuthajiyah 602', 'Takhassusi 220', 'Takhassusi 219', 'Takhassusi 218', 'Takhassusi 217', 'Takhassusi 216', 'Takhassusi 215', 'Takhassusi 213', 'Takhassusi 212', 'Takhassusi 210', 'Takhassusi 209', 'Takhassusi 208', 'Takhassusi 207', 'Takhassusi 206', 'Takhassusi 205', 'Takhassusi 204', 'Takhassusi 202', 'Takhassusi 201', 'Takhassusi 101', 'Takhassusi 103', 'Takhassusi 105', 'Takhassusi 106', 'Takhassusi 107', 'Takhassusi 108', 'Takhassusi 109', 'Takhassusi 110', 'Takhassusi 111', 'Takhassusi 112', 'Takhassusi 113', 'Takhassusi 114', 'Takhassusi 115', 'An-Namuthajiyah 503', 'Al Washm 301', 'Al-Muraba 510', 'Al Batha 101'
    ],
    "Bus 10": [
        'Al Batha 201', 'King Abdulaziz 215', 'Omar Bin Al Khatab 302', 'Omar Bin Al Khatab 303', 'Al Dharan 201', 'Salahuddin Al Ayubi 108', 'Al-Malaz 503', 'Al Ahsa 207', 'Al Ahsa 206', 'Al Ahsa 205', 'Al Ahsa 204', 'Al Ahsa 203', 'Al Ahsa 202', 'Al Ahsa 201', 'Makkah Al Mukarramah 303', 'Makkah Al Mukarramah 304', 'Makkah Al Mukarramah 305', 'Khurais 301', 'Khurais 302', 'Khalid Bin Al Walid 214', 'Khalid Bin Al Walid 213', 'Khalid Bin Al Walid 212', 'Khalid Bin Al Walid 211', 'Khalid Bin Al Walid 210', 'Khalid Bin Al Walid 209', 'Khalid Bin Al Walid 208', 'Khalid Bin Al Walid Layover Point', 'Khalid Bin Al Walid 207', 'Khalid Bin Al Walid 107', 'Khalid Bin Al Walid 109', 'Khalid Bin Al Walid 110', 'Khalid Bin Al Walid 111', 'Khalid Bin Al Walid 112', 'Khalid Bin Al Walid 113', 'Khalid Bin Al Walid 114', 'Khurais 402', 'Khurais 401', 'Makkah Al Mukarramah 406', 'Makkah Al Mukarramah 404', 'Makkah Al Mukarramah 403', 'Makkah Al Mukarramah 402', 'Salahuddin Al Ayubi 101', 'Salahuddin Al Ayubi 102', 'Salahuddin Al Ayubi 103', 'Salahuddin Al Ayubi 104', 'Salahuddin Al Ayubi 105', 'Salahuddin Al Ayubi 106', 'Salahuddin Al Ayubi 107', 'Al Dharan 101', 'Omar Bin Al Khatab 402', 'Omar Bin Al Khatab 401', 'Al Batha 101'
    ],
    "Bus 16": [
        'Al Batha 101', 'Al Batha 102', 'Ad-Dirah 605', 'Ash-Shomaisi 602', 'Ash-Shomaisi 601', 'Al-Badeah 603', 'Al-Badeah 609', 'Al-Badeah 608', 'Al-Badeah 607', 'Al-Badeah 606', 'Al-Badeah 505', 'Ayesha Bint Abi Bakr 204', 'Ayesha Bint Abi Bakr 104', 'Ibnul-Jouzi 402', 'Ibnul-Jouzi 401', 'Hamza Bin Abdulmuttalib 206', 'Hamza Bin Abdulmuttalib 205', 'West Al-Uraija 602', 'Bilal Bin Rabah 418', 'Bilal Bin Rabah 417', 'Bilal Bin Rabah 416', 'Bilal Bin Rabah 415', 'Bilal Bin Rabah 414', 'Bilal Bin Rabah 413', 'Bilal Bin Rabah 412', 'Bilal Bin Rabah 411', 'Bilal Bin Rabah 410', 'Bilal Bin Rabah 409', 'Bilal Bin Rabah 408', 'Bilal Bin Rabah 407', 'Bilal Bin Rabah 406', 'Bilal Bin Rabah 405', 'Bilal Bin Rabah 404', 'Bilal Bin Rabah 304', 'Bilal Bin Rabah 305', 'Bilal Bin Rabah 306', 'Bilal Bin Rabah 307', 'Bilal Bin Rabah 308', 'Bilal Bin Rabah 309', 'Bilal Bin Rabah 312', 'Bilal Bin Rabah 313', 'Bilal Bin Rabah 315', 'Bilal Bin Rabah 316', 'Bilal Bin Rabah 317', 'Bilal Bin Rabah 318', 'West Al-Uraija 501', 'West Al-Uraija 502', 'Hamza Bin Abdulmuttalib 105', 'Hamza Bin Abdulmuttalib 106', 'Hamza Bin Abdulmuttalib 107', 'Hamza Bin Abdulmuttalib 207', 'Ibnul-Jouzi 301', 'Ibnul-Jouzi 302', 'Al-Badeah 605', 'Al-Badeah 506', 'Al-Badeah 507', 'Al-Badeah 508', 'Al-Badeah 509', 'Al-Badeah 503', 'Ash-Shomaisi 503', 'Ash-Shomaisi 504', 'Ash-Shomaisi 505', 'Ad-Dirah 505', 'King Faisal 210', 'King Faisal 208', 'Al Batha 101'
    ],
    "Bus 17": [
        'Al Batha 101', 'Abi Ayoub Ansari 301', 'Abi Ayoub Ansari 302', 'Al Kharj 101', 'Al Kharj 102', 'Al Kharj 103', 'Al Kharj 104', 'Al Kharj 106', 'Al Kharj 107', 'Al Kharj 109', 'Al Kharj 110', 'Al Kharj 111', 'Al Kharj 113', 'Al Kharj 115', 'Al Kharj 116', 'Al Kharj 117', 'Al Kharj 118', 'Al Kharj 120', 'Al Kharj 124', 'New Industrial City 501', 'New Industrial City 502', 'New Industrial City 520', 'New Industrial City 620', 'New Industrial City 602', 'New Industrial City 601', 'Al Kharj 224', 'Al Kharj 223', 'Al Kharj 222', 'Al Kharj 219', 'Al Kharj 217', 'Al Kharj 216', 'Al Kharj 214', 'Al Kharj 212', 'Al Kharj 211', 'Al Kharj 210', 'Al Kharj 209', 'Al Kharj 207', 'Al Kharj 205', 'Al Kharj 204', 'Ammar Bin Yasir 402', 'Ammar Bin Yasir 401', 'Al Batha 205', 'Al Batha 204', 'Al Batha 202', 'Al Batha 201'
    ],
    "Bus 160": [
        'Al Batha 101', 'Al Batha 102', 'Al Batha 104', 'Al Batha 105', 'Al Batha 106', 'Al Batha 107', 'Al Batha 108', 'Al Batha 109', 'Al Haeer 101', 'Al Haeer 102', 'Al Haeer 104', 'Al Haeer 204', 'Al Haeer 203', 'Al Haeer 201', 'Al Batha 210', 'Al Batha 208', 'Al Batha 207', 'Al Batha 206', 'Al Batha 205', 'Al Batha 204', 'Al Batha 202', 'Al Batha 201'
    ],
    "Bus 660": [
        'Transportation Center A', 'Al-Basala 302', 'Ash Shabab 101', 'Ash Shabab 102', 'Ash Shabab 103', 'An-Nasar 402', 'An-Nasar 401', 'Al Haeer 106', 'Al Haeer 108', 'Al Haeer 110', 'Arfat 412', 'Arfat 411', 'Arfat 410', 'Arfat 409', 'Arfat 408', 'Arfat 407', 'Arfat 406', 'Arfat 405', 'Arfat 403', 'Arfat 401', 'Imam Muslim 203', 'Imam Muslim 201', 'Al Khalifah Al Mamoon 301', 'Al Khalil bin Ahmed 205', 'Al Khalil bin Ahmed 204', 'Al Khalil bin Ahmed 203', 'Al Khalil bin Ahmed 202', 'Al Khalil bin Ahmed 201', 'Dirab 413', 'Dirab 412', 'Dirab 411', 'Dirab 410', 'Dirab 408', 'Dirab 407', 'Dirab 406', 'Dirab 405', 'Dirab 404', 'Dirab 402', 'Dirab 401', 'Dirab 301', 'Dirab 302', 'Dirab 303', 'Dirab 304', 'Dirab 305', 'Dirab 306', 'Dirab 307', 'Dirab 309', 'Dirab 310', 'Dirab 311', 'Dirab 312', 'Dirab 313', 'Al Khalil bin Ahmed 101', 'Al Khalil bin Ahmed 102', 'Al Khalil bin Ahmed 103', 'Al Khalil bin Ahmed 104', 'Al Khalil bin Ahmed 106', 'Al Khalifah Al Mamoon 401', 'Imam Muslim 102', 'Arfat 301', 'Arfat 302', 'Arfat 304', 'Arfat 306', 'Arfat 307', 'Arfat 308', 'Arfat 309', 'Arfat 310', 'Arfat 311', 'Al Haeer 210', 'Al Haeer 209', 'Al Haeer 207', 'Al Haeer 205', 'An-Nasar 301', 'An-Nasar 302', 'Ash Shabab 203', 'Ash Shabab 202', 'Ash Shabab 201', 'Al-Basala 402', 'Abi Saad Al Wazir 201', 'Transportation Center A'
    ],
    "Bus 680": [
        'Transportation Center A', 'Southern Ring 401', 'Al Faryan 205', 'Al Faryan 204', 'Al Faryan 203', 'Al-Yamamah 602', 'Al-Yamamah 601', 'Utayqah 616', 'Suwaidi Al Am 410', 'Suwaidi Al Am 409', 'Suwaidi Al Am 408', 'Sultanah 206', 'Sultanah 205', 'Sultanah 204', 'Sultanah 203', 'Olaishah 604', 'Olaishah 602', 'Al-Fakhiriyah 601', 'An-Namuthajiyah 603', 'An-Namuthajiyah 602', 'Takhassusi 220', 'Takhassusi 219', 'Takhassusi 218', 'Takhassusi 217', 'Takhassusi 216', 'Takhassusi 215', 'Takhassusi 213', 'Takhassusi 212', 'Takhassusi 210', 'Takhassusi 209', 'Takhassusi 208', 'King Abdullah 408', 'King Abdullah 405', 'King Abdullah 404', 'King Abdullah 403', 'King Abdullah 402', 'Irqah 609', 'Irqah 608', 'Irqah 607', 'Irqah 606', 'Irqah 605', 'Irqah 604', 'Irqah 603', 'Irqah 602', 'Irqah 601', 'Irqah 501', 'Irqah 502', 'Irqah 503', 'Irqah 504', 'Irqah 505', 'Irqah 506', 'Irqah 508', 'Al-Khuzama 501', 'King Abdullah 302', 'King Abdullah 304', 'King Abdullah 305', 'King Abdullah 307', 'King Abdullah 309', 'Takhassusi 108', 'Takhassusi 109', 'Takhassusi 110', 'Takhassusi 111', 'Takhassusi 112', 'Takhassusi 113', 'Takhassusi 114', 'Takhassusi 115', 'An-Namuthajiyah 503', 'Al-Fakhiriyah 501', 'Olaishah 501', 'Olaishah 503', 'Sultanah 103', 'Sultanah 104', 'Sultanah 105', 'Sultanah 106', 'Suwaidi Al Am 308', 'Suwaidi Al Am 309', 'Utayqah 516', 'Al-Yamamah 501', 'Al-Yamamah 502', 'Al Faryan 103', 'Al Faryan 104', 'Al Faryan 105', 'Southern Ring 301', 'Transportation Center A'
    ],
    "Bus 341": [
        'KSU 503', 'KSU 504', 'King Abdullah 403', 'King Abdullah 402', 'King Khalid 102', 'Al Urubah 302', 'Al Urubah 303', 'Al Urubah 304', 'Al Urubah 305', 'Al Urubah 306', 'Al Urubah 307', 'Al Urubah 308', 'Al Urubah 309', 'Al Urubah 310', 'Al Urubah 311', 'Al Urubah 312', 'Al Urubah 313', 'Abdulrahman Al Ghafqi 301', 'Abdulrahman Al Ghafqi 302', 'Abdulrahman Al Ghafqi 303', 'Khalid Bin Al Walid 212', 'Abdulrahman Al Ghafqi 403', 'Abdulrahman Al Ghafqi 402', 'Abdulrahman Al Ghafqi 401', 'Al Urubah 413', 'Al Urubah 412', 'Al Urubah 411', 'Al Urubah 410', 'Al Urubah 409', 'Al Urubah 408', 'Al Urubah 407', 'Al Urubah 406', 'Al Urubah 405', 'Al Urubah 404', 'Al Urubah 403', 'Al Urubah 401', 'King Khalid 202', 'King Abdullah 301', 'King Abdullah 302', 'KSU 604', 'KSU 603'
    ],
    "Bus 150": [
        'Amr Bin Al Aas 307', 'Nasseriya 303', 'Nasseriya 304', 'Al-Muraba 501', 'Al-Muraba 502', 'Al-Muraba 503', 'Ma`Ahad Al Idarah 301', 'Ma`Ahad Al Idarah 302', 'Omar Bin Abdulaziz 301', 'Omar Bin Abdulaziz 302', 'Omar Bin Abdulaziz 303', 'Omar Bin Abdulaziz 304', 'Omar Bin Abdulaziz 305', 'Omar Bin Abdulaziz 306', 'Omar Bin Abdulaziz 308', 'Omar Bin Abdulaziz 309', 'Unayzah 203', 'Ar-Rawabi 501', 'Ar-Rawabi 502', 'Ar-Rawabi 503', 'As-Salam 501', 'As-Salam 503', 'As-Salam 505', 'West An-Naseem 502', 'West An-Naseem 503', 'Hassan Bin Thabit 205', 'Abdullah Bin Saleem 301', 'Ar-Rimayah 502', 'Ar-Rimayah 602', 'East An-Naseem 603', 'Mohammed Bin Hindi 401', 'West An-Naseem 604', 'West An-Naseem 601', 'As-Salam 604', 'As-Salam 603', 'As-Salam 602', 'As-Salam 601', 'Ar-Rawabi 603', 'Ar-Rawabi 601', 'Unayzah 103', 'Omar Bin Abdulaziz 410', 'Omar Bin Abdulaziz 407', 'Omar Bin Abdulaziz 406', 'Omar Bin Abdulaziz 404', 'Omar Bin Abdulaziz 402', 'Omar Bin Abdulaziz 401', 'Salahuddin Al Ayubi 104', 'Salahuddin Al Ayubi 105', 'Ma`Ahad Al Idarah 402', 'Ma`Ahad Al Idarah 401', 'Al-Muraba 603', 'Al-Muraba 602', 'Al-Muraba 601', 'Nasseriya 404', 'Nasseriya 402', 'Nasseriya 401', 'Al-Fakhiriyah 501', 'Amr Bin Al Aas 307'
    ],
    "Bus 430": [
        'Khalid Bin Al Walid 207', 'Khalid Bin Al Walid 206', 'Al-Hamra 602', 'Al-Hamra 601', 'Al-Ezdihar 604', 'Al-Ezdihar 602', 'Al-Nuzha 602', 'Al-Nuzha 601', 'Al-Maseef 601', 'Al-Murooj 603', 'Al-Murooj 602', 'Al-Murooj 601', 'Al-Nakheel 607', 'Al-Nakheel 606', 'Al-Muhammadiyah 502', 'King Abdullah 405', 'King Abdullah 404', 'KSU 605', 'KSU 606', 'KSU 506', 'KSU 505', 'King Abdullah 304', 'King Abdullah 305', 'King Abdullah 307', 'Al-Muhammadiyah 601', 'Al-Nakheel 507', 'Al-Murooj 501', 'Al-Murooj 503', 'Al-Maseef 501', 'Al-Maseef 502', 'Al-Nuzha 501', 'Al-Ezdihar 504', 'Khalid Bin Al Walid 105', 'Khalid Bin Al Walid 107'
    ],
    "Bus 350": [
        'KSU 506', 'KSU 507', 'KSU 508', 'KSU 503', 'KSU 504', 'King Abdullah 304', 'King Abdullah 305', 'King Abdullah 307', 'Ar-Raed 502', 'Ar-Raed 503', 'Ar-Raed 504', 'North Al-Mathar 501', 'North Al-Mathar 502', 'North Al-Mathar 503', 'North Al-Mathar 504', 'Al-Mathar 501', 'Al-Mathar 503', 'King Khalid 106', 'King Saud 301', 'An-Namuthajiyah 501', 'An-Namuthajiyah 503', 'Amr Bin Al Aas 307', 'Nasseriya 303', 'Nasseriya 304', 'King Abdulaziz 215', 'Omar Bin Al Khatab 302', 'Omar Bin Al Khatab 303', 'Omar Bin Al Khatab 304', 'Omar Bin Al Khatab 305', 'Omar Bin Al Khatab 306', 'Omar Bin Al Khatab 309', 'Al-Jazeerah 505', 'Al-Jazeerah 506', 'Haroon Rasheed 205', 'Haroon Rasheed 201']
}

bus_images = {
    # Replace these URLs with the actual image URLs for each bus route
    "Bus 9": "https://i.imgur.com/iDzACj5.png",
    "Bus 7": "https://i.imgur.com/jDOJZCK.png",
    "Bus 8": "https://i.imgur.com/p7GZejI.png",
    "Bus 10": "https://i.imgur.com/rnKO7up.png",
    "Bus 16": "https://i.imgur.com/qKnzFEC.png",
    "Bus 17": "https://i.imgur.com/ykrD7e3.png",
    "Bus 160": "https://i.imgur.com/d7nj24n.jpg",
    "Bus 660": "https://i.imgur.com/I4DwMuQ.png",
    "Bus 680": "https://i.imgur.com/dgJGtd6.png"A
}

def find_route():
    start = start_entry.get()
    destination = destination_entry.get()

    fastest_route = ""
    fastest_time = float("inf")

    cheapest_route = ""
    cheapest_cost = float("inf")

    for bus1 in bus_routes:
        if start in bus_routes[bus1]:
            for bus2 in bus_routes:
                if destination in bus_routes[bus2]:
                    if bus1 == bus2:
                        time = abs(bus_routes[bus1].index(start) - bus_routes[bus2].index(destination))
                        cost = len(set([bus1]))
                        route = f"{bus1} to station {destination} ({time} stops) - Alpha v0.10"

                        if time < fastest_time:
                            fastest_time = time
                            fastest_route = route

                        if cost < cheapest_cost:
                            cheapest_cost = cost
                            cheapest_route = route
                    else:
                        for intersect in set(bus_routes[bus1]).intersection(bus_routes[bus2]):
                            time1 = abs(bus_routes[bus1].index(start) - bus_routes[bus1].index(intersect))
                            time2 = abs(bus_routes[bus2].index(intersect) - bus_routes[bus2].index(destination))
                            time = time1 + time2
                            cost = len(set([bus1,bus2]))
                            route = f"{bus1} to station {intersect} ({time1} stops), {bus2} to station {destination} ({time2} stops) - Alpha v0.10"

                            if time < fastest_time:
                                fastest_time = time
                                fastest_route = route

                            if cost < cheapest_cost:
                                cheapest_cost = cost
                                cheapest_route = route
                        for bus3 in bus_routes:
                            for intersect in set(bus_routes[bus1]).intersection(bus_routes[bus3]):
                                for intersect2 in set(bus_routes[bus3]).intersection(bus_routes[bus2]):
                                    time1 = abs(bus_routes[bus1].index(start) - bus_routes[bus1].index(intersect))
                                    time2 = abs(bus_routes[bus3].index(intersect) - bus_routes[bus3].index(intersect2))
                                    time3 = abs(bus_routes[bus2].index(intersect2) - bus_routes[bus2].index(destination))
                                    time = time1 + time2 + time3
                                    cost = len(set([bus1,bus2,bus3]))
                                    route = f"{bus1} to station {intersect} ({time1} stops), {bus3} to station {intersect2} ({time2} stops), {bus2} to station {destination} ({time3} stops) - Alpha v0.10"

                                    if time < fastest_time:
                                        fastest_time = time
                                        fastest_route = route

                                    if cost < cheapest_cost:
                                        cheapest_cost = cost
                                        cheapest_route = route
                            for bus4 in bus_routes:
                                for intersect in set(bus_routes[bus1]).intersection(bus_routes[bus3]):
                                    for intersect2 in set(bus_routes[bus3]).intersection(bus_routes[bus4]):
                                        for intersect3 in set(bus_routes[bus4]).intersection(bus_routes[bus2]):
                                            time1 = abs(bus_routes[bus1].index(start) - bus_routes[bus1].index(intersect))
                                            time2 = abs(bus_routes[bus3].index(intersect) - bus_routes[bus3].index(intersect2))
                                            time3 = abs(bus_routes[bus4].index(intersect2) - bus_routes[bus4].index(intersect3))
                                            time4 = abs(bus_routes[bus2].index(intersect3) - bus_routes[bus2].index(destination))
                                            time = time1 + time2 + time3 + time4
                                            cost = len(set([bus1,bus2,bus3,bus4]))
                                            route = f"{bus1} to station {intersect} ({time1} stops), {bus3} to station {intersect2} ({time2} stops), {bus4} to station {intersect3} ({time3} stops), {bus2} to station {destination} ({time4} stops) - Alpha v0.10"

                                            if time < fastest_time:
                                                fastest_time = time
                                                fastest_route = route

                                            if cost < cheapest_cost:
                                                cheapest_cost = cost
                                                cheapest_route = route

    result_label.config(text=f"Fastest Route: {fastest_route}\nCheapest Route: {cheapest_route}")
def on_bus_select(event):
    bus = bus_select.get()
    stations_text.config(state=tk.NORMAL)
    stations_text.delete("1.0", tk.END)
    stations_text.insert(tk.END, "\n".join(bus_routes[bus]))
    stations_text.config(state=tk.DISABLED)

    image_url = bus_images[bus]
    with urllib.request.urlopen(image_url) as url:
        image_data = url.read()
    image = Image.open(io.BytesIO(image_data))
    image.thumbnail((400, 400), Image.LANCZOS)
    photo = ImageTk.PhotoImage(image)
    route_image.configure(image=photo)
    route_image.image = photo

root = tk.Tk()
root.title("Riyadh Transport")

tab_control = ttk.Notebook(root)

route_finder_tab = ttk.Frame(tab_control)
tab_control.add(route_finder_tab, text="Route Finder")

start_label = tk.Label(route_finder_tab, text="Enter your starting station:")
start_label.pack()

start_entry = tk.Entry(route_finder_tab)
start_entry.pack()

destination_label = tk.Label(route_finder_tab, text="Enter your destination station:")
destination_label.pack()

destination_entry = tk.Entry(route_finder_tab)
destination_entry.pack()

button = tk.Button(route_finder_tab, text="Find Route", command=find_route)
button.pack()

result_label = tk.Label(route_finder_tab, text="")
result_label.pack()

bus_info_tab = ttk.Frame(tab_control)
tab_control.add(bus_info_tab, text="Bus Information")

bus_select_label = tk.Label(bus_info_tab, text="Select a bus:")
bus_select_label.pack()

bus_select = ttk.Combobox(bus_info_tab, values=list(bus_routes.keys()))
bus_select.bind("<<ComboboxSelected>>", on_bus_select)
bus_select.pack()

stations_text_label = tk.Label(bus_info_tab, text="Stations:")
stations_text_label.pack()

stations_text = tk.Text(bus_info_tab, height=10, width=50)
stations_text.pack()
stations_text.config(state=tk.DISABLED)

route_image_label = tk.Label(bus_info_tab, text="Route Image:")
route_image_label.pack()

route_image = tk.Label(bus_info_tab)
route_image.pack()

tab_control.pack(expand=1, fill="both")

root.mainloop()
