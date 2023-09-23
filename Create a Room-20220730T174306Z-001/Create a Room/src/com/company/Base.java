package com.company;

import com.company.Objects.*;
import com.company.RoomsNDoors.*;

import java.util.Scanner;

public class Base {

    // create start
    public static String blank = "        ";
    public static String here31 = "****";
    public static String here34 = "****";
    public static String here32 = "  * ";
    public static String here33 = " *  ";
    public static String TV31 = "        ";
    public static String TV34 = "        ";
    public static String NnStv = "   TV   ";
    public static String EnWtv = " TV ";
    public static String here3 = "        ";
    public static String here7 = "        ";
    public static String here8 = "        ";
    public static String here9 = "        ";
    public static String here11 = "        ";
    public static String here12 = "        ";
    public static String here13 = "        ";
    public static String here14 = "        ";
    public static String here15 = "        ";
    public static String here17 = "        ";
    public static String here18 = "        ";
    public static String here19 = "        ";
    public static String here23 = "        ";
    public static String you3= "        ";
    public static String you7= "        ";
    public static String you8= "        ";
    public static String you9= "        ";
    public static String you11= "        ";
    public static String you12= "        ";
    public static String you13= "        ";
    public static String you14= "        ";
    public static String you15= "        ";
    public static String you17= "        ";
    public static String you18= "        ";
    public static String you19= "        ";
    public static String you23= "        ";
    public static String you = "  YOU   ";

    public void printMap(int position) {
        System.out.println();
        System.out.println("                           N                        ");
        System.out.println();
        System.out.println("                       " + here3 + "                      ");
        System.out.println("                       "+you3+"                              ");
        System.out.println("              ******** **" + here31 + "** ********             ");
        System.out.println("            * " + blank + " " + TV31 + " " + blank + " *            ");
        System.out.println("            * " + here7 + "*" + here8 + "*" + here9 + " *            ");
        System.out.println("            * " + you7 + " " + you8 + " " + you9 + " *            ");
        System.out.println("              *   *   *   *    *   *   *            ");
        System.out.println("            * " + blank + " " + blank + " " + blank + " *            ");
        System.out.println("W " + here11 + here32 + here12 + "*" + here13 + "*" + here14 + here33 + here15 + " E");
        System.out.println("    "+you11+"* " + you12 + " " + you13 + " " + you14 + " *"+you15+"    ");
        System.out.println("              *   *   *    *   *   *   *              ");
        System.out.println("            * " + you17 + " " + you18 + " " + you19 + " *            ");
        System.out.println("            * " + here17 + "*" + here18 + "*" + here19 + " *         ");
        System.out.println("            * " + blank + " " + TV34 + " " + blank + " *            ");
        System.out.println("              ******** **" + here34 + "** ********              ");
        System.out.println("                       "+you23+"                               ");
        System.out.println("                       " + here23 + "                      ");
        System.out.println();
        System.out.println("                          S                        ");
    }

    public static void setHere(String object, int position) {
        switch (position) {
            case 3:
                here3 = object;
                break;
            case 7:
                here7 = object;
                break;
            case 8:
                here8 = object;
                break;
            case 9:
                here9 = object;
                break;
            case 11:
                here11 = object;
                break;
            case 12:
                here12 = object;
                break;
            case 13:
                here13 = object;
                break;
            case 14:
                here14 = object;
                break;
            case 15:
                here15 = object;
                break;
            case 17:
                here17 = object;
                break;
            case 18:
                here18 = object;
                break;
            case 19:
                here19 = object;
                break;
            case 23:
                here23 = object;
                break;
            case 31:
                if (object.toLowerCase().equals("tv")){
                    TV31=NnStv;
                }else here31=object;
                break;
            case 32:
                if (object.toLowerCase().equals("tv")){
                    here32=EnWtv;
                }else here32=object;
                break;
            case 33:
                if (object.toLowerCase().equals("tv")){
                    here33=EnWtv;
                }else here33=object;
                break;
            case 34:
                if (object.toLowerCase().equals("tv")){
                    TV34=NnStv;
                }else here34 =object;
        }
    }

    public static String directionGetter(int position) {
        switch (position) {
            case 7:
                return "north western side of the house.";
            case 8:
                return "northern side of the house.";
            case 9:
                return "north eastern side of the house.";
            case 12:
                return "western side of the house";
            case 13:
                return "middle of the house";
            case 14:
                return "eastern side of the house";
            case 17:
                return "south western side of the house";
            case 18:
                return "southern side of the house";
            case 19:
                return "south eastern side of the house";
            case 31:
                return "north wall of the house";
            case 34:
                return "south wall of the house";
            case 32:
                return "west wall of the house";
            case 33:
                return "east wall of the house";
            case 11:
                return "west of the house, on the other side of the wall";
            case 15:
                return "east of the house, on the other side of the wall";
            case 23:
                return "south of the house, on the other side of the house";
            case 3:
                return "north of the house, on the other side of the house";
            default:
                return "error in position of the object";
        }
    }

    public static int OUTGetPositionOfInitials(String initials) {
        switch (initials.toLowerCase()) {
            case "n":
                return 3;
            case "s":
                return 23;
            case "e":
                return 15;
            case "w":
                return 11;
            default:
                return -1;
        }
    }

    public static int WALLGetPositionOfInitials(String initials) {
        switch (initials.toLowerCase()) {
            case "n":
                return 31;
            case "s":
                return 34;
            case "w":
                return 32;
            case "e":
                return 33;
            default:
                return -1;
        }
    }

    public static int INGetPositionOfInitials(String initials) {
        switch (initials.toLowerCase()) {
            case "nw":
                return 7;
            case "n":
                return 8;
            case "ne":
                return 9;
            case "w":
                return 12;
            case "m":
                return 13;
            case "e":
                return 14;
            case "sw":
                return 17;
            case "s":
                return 18;
            case "se":
                return 19;
            default:
                return -1;
        }
    }

    public static int OUTnWALLGetPosition(String initials) {
        switch (initials.toLowerCase()) {
            case "n":
                return 8;
            case "s":
                return 18;
            case "e":
                return 14;
            case "w":
                return 12;
            default:
                return -1;
        }
    }

    public static void printMap(int objectNumber, String initials) {
        switch (objectNumber) {
            case 1:
                Bed bed = new Bed();
                bed.printMap(INGetPositionOfInitials(initials));
                break;
            case 2:
                BookShelf bookShelf = new BookShelf();
                bookShelf.printMap(INGetPositionOfInitials(initials));
                break;
            case 3:
                Chair chair = new Chair();
                chair.printMap(INGetPositionOfInitials(initials));
                break;
            case 4:
                Closet closet = new Closet();
                closet.printMap(INGetPositionOfInitials(initials));
                break;
            case 5:
                DiningTable diningTable = new DiningTable();
                diningTable.printMap(INGetPositionOfInitials(initials));
                break;
            case 6:
                PC pc = new PC();
                pc.printMap(INGetPositionOfInitials(initials));
                break;
            case 7:
                ShoeRack shoeRack = new ShoeRack();
                shoeRack.printMap(INGetPositionOfInitials(initials));
                break;
            case 8:
                ShowCase showCase = new ShowCase();
                showCase.printMap(INGetPositionOfInitials(initials));
                break;
            case 9:
                Sofa sofa = new Sofa();
                sofa.printMap(INGetPositionOfInitials(initials));
                break;
            case 10:
                StudyTable studyTable = new StudyTable();
                studyTable.printMap(INGetPositionOfInitials(initials));
                break;
            case 11:
                TV tv = new TV();
                tv.printMap(OUTnWALLGetPosition(initials));
                break;
            case 12:
                Bathroom bathroom = new Bathroom();
                bathroom.printMap(OUTnWALLGetPosition(initials));
                break;
            case 13:
            case 14:
            case 15:
            case 16:
                switch (initials.toLowerCase()) {
                    case "n":
                        Door1 door1 = new Door1();
                        door1.printMap(8);
                        break;
                    case "w":
                        Door2 door2 = new Door2();
                        door2.printMap(12);
                        break;
                    case "e":
                        Door3 door3 = new Door3();
                        door3.printMap(14);
                        break;
                    case "s":
                        Door4 door4 = new Door4();
                        door4.printMap(18);
                        break;
                }
                break;
            case 17:
                Hell hell = new Hell();
                hell.printMap(OUTnWALLGetPosition(initials));
                break;
            case 18:
                Kitchen kitchen = new Kitchen();
                kitchen.printMap(OUTnWALLGetPosition(initials));
                break;
            case 19:
                Cushion cushion = new Cushion();
                cushion.printMap(INGetPositionOfInitials(initials));
                break;
            default:
                System.out.println("something is wrong in print map or create.\npls contact Om Tank");
        }
    }

    public static String getObjectOfNumbers(int objectNumber) {
        switch (objectNumber) {
            case 1:
                return "a bed";
            case 2:
                return "a bookshelf";
            case 3:
                return "a chair";
            case 4:
                return "a closet";
            case 5:
                return "a dining table";
            case 6:
                return "a PC";
            case 7:
                return "a shoe rack";
            case 8:
                return "a show case";
            case 9:
                return "a sofa";
            case 10:
                return "a study table";
            case 11:
                return "a TV";
            case 12:
                return "a bathroom";
            case 13:
            case 14:
            case 15:
            case 16:
                return "a door";
            case 17:
                return "hell";
            case 18:
                return "kitchen";
            case 19:
                return "a cushion";
            default:
                System.out.println("problem in getObjectOfNumber.pls contact OM TANK");
                return null;
        }
    }

    public static String crushedInfo(int objectNumber) {
        String crushStatement = "you were crushed by ";
        switch (objectNumber) {
            case 1:
                You.dead = true;
                return crushStatement + " a Bed.";
            case 2:
                You.dead = true;
                return crushStatement + "a Bookshelf";
            case 3:
                You.dead = true;
                return crushStatement + "a chair";
            case 4:
                You.dead = true;
                return crushStatement + "a closet";
            case 5:
                You.dead = true;
                return crushStatement + "a Dining Table";
            case 6:
                You.dead = true;
                return crushStatement + "a PC";
            case 7:
                You.dead = true;
                return crushStatement + "a Shoe Rack";
            case 8:
                You.dead = true;
                return crushStatement + "a Show Case";
            case 9:
                You.dead = true;
                return crushStatement + "a Sofa";
            case 10:
                You.dead = true;
                return crushStatement + "a Study Table";
            case 11:
                You.dead = true;
                return crushStatement + "a TV";
            case 12:
                You.dead = true;
                return crushStatement + "a Bathroom";
            case 13:
            case 14:
            case 15:
            case 16:
                You.dead = true;
                return crushStatement + "a Door";
            case 17:
                You.dead = true;
                return crushStatement + "Hell";
            case 18:
                You.dead = true;
                return crushStatement + "a Kitchen";
            case 19:
                if (You.Lives <= 5) {
                    You.dead = true;
                    return "you were heavily injured cause a giant cushion fell on you from sky\n" +
                            "five lives deducted \n" +
                            "remaining lives = 0";
                }
                You.Lives -= 5;
                return "you were heavily injured cause a giant cushion fell on you from sky\n" +
                        "five lives deducted.\n" +
                        "remaining lives = " + (You.Lives);
            default:
                return "error in object number \n" +
                        "Pls contact Om Tank.";
        }
    }

    public static int getPositionOfObjectNumber(int objectNumber) {
        switch(objectNumber){
            case 1:
                return Bed.position;
            case 2:
                return BookShelf.position;
            case 3:
                return Chair.position;
            case 4:
                return Closet.position;
            case 5:
                return DiningTable.position;
            case 6:
                return PC.position;
            case 7:
                return ShoeRack.position;
            case 8:
                return ShowCase.position;
            case 9:
                return Sofa.position;
            case 10:
                return StudyTable.position;
            case 11:
                return TV.position;
            case 12:
                return Bathroom.position;
            case 13:
                return Door1.position;
            case 14:
                return Door2.position;
            case 15:
                return Door3.position;
            case 16:
                return Door4.position;
            case 17:
                return Hell.position;
            case 18:
                return Kitchen.position;
            default:
                System.out.println("problem in get position of object number");
                return -1;
        }
    }

    public static void alreadyPresentStatement(int objectNumber,int i){
        System.out.println(getObjectOfNumbers(i)+" is already present where you want to create "+getObjectOfNumbers(objectNumber));
    }

    public static boolean positionEvaluator(int objectNumber, String initials) {
        boolean clear=true;
        switch (objectNumber) {
            case 12:
            case 17:
            case 18:
                if (WALLGetPositionOfInitials(initials)== TV.position){
                    System.out.println("you cant create "+getObjectOfNumbers(objectNumber)+ " "+directionGetter(OUTGetPositionOfInitials(initials))+"\n" +
                            "because there is already a TV where you will create a door and hence you will not be able to enter the room.");
                    clear =false;
                }
                for (int i=1;i<=18;i++){
                    if (OUTGetPositionOfInitials(initials)==getPositionOfObjectNumber(i)){
                        alreadyPresentStatement(objectNumber,i);
                        clear =false;
                    }
                }
                break;
            case 11:
                if (OUTGetPositionOfInitials(initials)==getPositionOfObjectNumber(12)||OUTGetPositionOfInitials(initials)==getPositionOfObjectNumber(17)||OUTGetPositionOfInitials(initials)==getPositionOfObjectNumber(18)){
                    System.out.println("you cant create a TV on here because then you wont be able to create the door to enter that place.");
                    clear=false;
                }
            case 13:
            case 14:
            case 15:
            case 16:
                for (int i=1;i<=18;i++){
                    if (WALLGetPositionOfInitials(initials)==getPositionOfObjectNumber(i)){
                        alreadyPresentStatement(objectNumber,i);
                        clear =false;
                    }
                }
                break;
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
            case 19:
                for (int i=1;i<=18;i++){
                    if (INGetPositionOfInitials(initials)==getPositionOfObjectNumber(i)){
                        alreadyPresentStatement(objectNumber,i);
                        clear=false;
                    }
                }
                break;
            default:
                System.out.println("error in position evaluator(create).\n" +
                        "pls contact OM TANK");
        }
        return clear;
    }

    public static void OUTCreateMap(int objectNumber,String positionInitials) {
        String initials;
        if (positionInitials==null){
            Scanner scanner = new Scanner(System.in);
            System.out.println("where do you want to create a " + Actions.v_1);
            System.out.println("type N,S,E, or W");
            initials = scanner.nextLine().toLowerCase();
        }else {
            initials=positionInitials;
        }
        if (initials.equals("n") || initials.equals("e") || initials.equals("w") || initials.equals("s")) {
            if (positionEvaluator(objectNumber,initials)) {
                if(positionInitials==null) {
                    printMap(objectNumber, initials);
                }else{
                    printMap(objectNumber,positionInitials);
                }
                System.out.println("mysteriously a " + Actions.v_1 + " dropped from the sky and landed exactly on the " + Base.directionGetter(Base.OUTGetPositionOfInitials(initials)));
                if (OUTGetPositionOfInitials(initials.toLowerCase()) == You.position) {
                    System.out.println(crushedInfo(objectNumber));
                }
            }
        } else {
            System.out.println("you can create something outside the house only to north,south ,east or west");
        }
    }

    public static void WALLCreateMap(int objectNumber,String positionInitials) {
        String initials;
        if(positionInitials==null){
            Scanner scanner = new Scanner(System.in);
            System.out.println("where do you want to create a " + Actions.v_1);
            System.out.println("type N,S,E, or W");
            initials = scanner.nextLine().toLowerCase();
        } else{
            initials=positionInitials;
        }
        if (initials.equals("n") || initials.equals("e") || initials.equals("w") || initials.equals("s")) {
            if (positionEvaluator(objectNumber,initials)) {
                if(positionInitials==null){
                    printMap(objectNumber, initials);
                }else{
                    printMap(objectNumber,positionInitials);
                }
                System.out.println("mysteriously a " + Actions.v_1 + " dropped from the sky and landed exactly on the " + Base.directionGetter(Base.WALLGetPositionOfInitials(initials)));
            }
        } else {
            System.out.println("you can create "+Actions.v_1+" only on north,south ,east or west of the house");
        }
    }

    public static void INCreateMap(int objectNumber,String positionInitials) {
        String initials;
        if (positionInitials==null){
            Scanner scanner = new Scanner(System.in);
            System.out.println("where do you want to create a " + Actions.v_1);
            System.out.println("type N,NE,E,NW,W,SW,SE,S or Middle(type 'm')");
            initials = scanner.nextLine();
        } else{
            initials=positionInitials;
        }
        if (initials.equals("nw") || initials.equals("n") || initials.equals("ne") || initials.equals("w") || initials.equals("m") || initials.equals("e") || initials.equals("sw") || initials.equals("s") || initials.equals("se")) {
            if (positionEvaluator(objectNumber,initials)){
            if(positionInitials==null){
                printMap(objectNumber, initials);
            }else{
                printMap(objectNumber,positionInitials);
            }
                System.out.println("mysteriously a " + Actions.v_1 + " dropped from the sky and landed exactly on the " + Base.directionGetter(Base.INGetPositionOfInitials(initials)));
                if (INGetPositionOfInitials(initials.toLowerCase())==You.position) {
                    System.out.println(crushedInfo(objectNumber));
                }
            }
    }else {
            System.out.println("please only type initials.\n" +
                    "try again.");
        }
    }

//create end
//
//go start
    public static int positionBed=-10;
    public static int positionShelf=-10;
    public static int positionChair=-10;
    public static int positionCloset=-10;
    public static int positionCushion=-10;
    public static int positionDine=-10;
    public static int positionPC=-10;
    public static int positionShoeRack=-10;
    public static int positionShowCase=-10;
    public static int positionSofa=-10;
    public static int positionTable=-10;
    public static int positionTV=-10;
    public static int positionBathroom=-10;
    public static int SectorPositionDoor1=-10;
    public static int SectorPositionDoor2=-10;
    public static int SectorPositionDoor3=-10;
    public static int SectorPositionDoor4=-10;
    public static int positionHell=-10;
    public static int positionKitchen=-10;

    public static int getNewPosition(int position, String initials) {
        int newPosition;
        switch (initials.toLowerCase()) {
            case "ne":
                newPosition = position - 4;
                break;
            case "n":
                newPosition = position - 5;
                break;
            case "nw":
                newPosition = position - 6;
                break;
            case "w":
                newPosition = position - 1;
                break;
            case "e":
                newPosition = position + 1;
                break;
            case "s":
                newPosition = position + 5;
                break;
            case "se":
                newPosition = position + 6;
                break;
            case "sw":
                newPosition = position + 4;
                break;
            default:
                newPosition = -1;

        }
        return newPosition;
    }

    public static String getDirection(int number) {
        switch (number) {
            case 0:
                return "north ";
            case 1:
                return "northeast ";
            case 2:
                return "east ";
            case 3:
                return "southeast ";
            case 4:
                return "south ";
            case 5:
                return "southwest ";
            case 6:
                return "west ";
            case 7:
                return "northwest ";
            default:
                return "problem in examining surroundings\n" +
                        "pls contact Om Tank.";
        }
    }

    public static int position(int newPosition, int direction) {
        switch (direction) {
            case 0:
                return newPosition - 5;
            case 1:
                return newPosition - 4;
            case 2:
                return newPosition + 1;
            case 3:
                return newPosition + 6;
            case 4:
                return newPosition + 5;
            case 5:
                return newPosition + 4;
            case 6:
                return newPosition - 1;
            case 7:
                return newPosition - 6;
            default:
                return newPosition;
        }
    }

    public static void checkPosition(int newPosition, int i) {
        if (position(newPosition, i) == positionBed) {
            System.out.println("there is a bed towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionShelf) {
            System.out.println("there is a book shelf towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionChair) {
            System.out.println("there is a chair towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionCloset) {
            System.out.println("there is a Closet towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionCushion) {
            System.out.println("there is a Cushion towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionDine) {
            System.out.println("there is a Dining table towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionPC) {
            System.out.println("there is a PC towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionShoeRack) {
            System.out.println("there is a ShoeRack towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionShowCase) {
            System.out.println("there is a ShowCase towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionSofa) {
            System.out.println("there is a Sofa towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionTable) {
            System.out.println("there is a StudyTable towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionTV) {
            System.out.println("there is a TV towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionBathroom) {
            if (isNotOutside(newPosition)) {
                System.out.println("there is a Bathroom towards " + getDirection(i));
            }
        }
        if (position(newPosition, i) == SectorPositionDoor1) {
            System.out.println("there is a Door towards " + getDirection(i));
        }
        if (position(newPosition, i) == SectorPositionDoor2) {
            System.out.println("there is a door towards " + getDirection(i));
        }
        if (position(newPosition, i) == SectorPositionDoor3) {
            System.out.println("there is a door towards " + getDirection(i));
        }
        if (position(newPosition, i) == SectorPositionDoor4) {
            System.out.println("there is a door towards " + getDirection(i));
        }
        if (position(newPosition, i) == positionHell) {
            if (isNotOutside(newPosition)) {
                System.out.println("there is hell towards " + getDirection(i));
            }
        }
        if (position(newPosition, i) == positionKitchen) {
            if (isNotOutside(newPosition)) {
                System.out.println("there is a Kitchen towards " + getDirection(i));
            }
        }
    }

    public static boolean isNotOutside(int newPosition) {
        return newPosition != 3 && newPosition != 11 && newPosition != 15 && newPosition != 23;
    }

    public static void examineSurrounding(int position, String initials) {
        for (int i = 0; i < 8; i++) {
            checkPosition(getNewPosition(position, initials), i);
        }
    }

    public static boolean movementEvaluator(int position, String initials) {
        switch (initials.toLowerCase()) {
            case "northeast":
            case "ne":
                switch (position) {
                    case 12:
                    case 13:
                    case 17:
                    case 18:
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "north":
            case "n":
                switch (position) {
                    case 12:
                    case 13:
                    case 14:
                    case 17:
                    case 18:
                    case 19:
                        return true;
                    case 23:
                        if (Door4.position != 34) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door4.doorOpen4) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    case 8:
                        if (Door1.position != 31) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door1.doorOpen1) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "northwest":
            case "nw":
                switch (position) {
                    case 13:
                    case 14:
                    case 18:
                    case 19:
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "west":
            case "w":
                switch (position) {
                    case 8:
                    case 9:
                    case 13:
                    case 14:
                    case 18:
                    case 19:
                        return true;
                    case 12:
                        if (Door2.position != 32) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door2.doorOpen2) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    case 15:
                        if (Door3.position != 33) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door3.doorOpen3) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "east":
            case "e":
                switch (position) {
                    case 7:
                    case 8:
                    case 12:
                    case 13:
                    case 17:
                    case 18:
                        return true;
                    case 11:
                        if (Door2.position != 32) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door2.doorOpen2) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    case 14:
                        if (Door3.position != 33) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door3.doorOpen3) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return true;
                        }
                        return false;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "south":
            case "s":
                switch (position) {
                    case 7:
                    case 8:
                    case 9:
                    case 12:
                    case 13:
                    case 14:
                        return true;
                    case 3:
                        if (Door1.position != 31) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door1.doorOpen1) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    case 18:
                        if (Door4.position != 34) {
                            You.Lives -= 1;
                            System.out.println("you hit a wall");
                            System.out.println("pls create a door to go through");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        if (!Door4.doorOpen4) {
                            You.Lives -= 1;
                            System.out.println("you hit the door");
                            System.out.println("pls open doors from the next time");
                            System.out.println("one life deducted");
                            System.out.println("lives remaining = " + You.Lives);
                            if (You.Lives == 0) {
                                You.dead = true;
                            }
                            return false;
                        }
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "southeast":
            case "se":
                switch (position) {
                    case 7:
                    case 8:
                    case 12:
                    case 13:
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            case "southwest":
            case "sw":
                switch (position) {
                    case 8:
                    case 9:
                    case 13:
                    case 14:
                        return true;
                    default:
                        You.Lives -= 1;
                        System.out.println("you have hit a wall.");
                        System.out.println("one life deducted");
                        System.out.println("lives remaining = " + You.Lives);
                        if (You.Lives == 0) {
                            You.dead = true;
                        }
                        return false;
                }
            default:
                System.out.println("whatever you typed is not registers as a direction.");
                System.out.println("please type the initials ONLY for directions");
                return false;
        }
    }

    public static void examinePosition(int position, String initials) {
        if (getNewPosition(position, initials) == positionBed) {
            System.out.println("you see a bed beside you.\n" +
                    "a pretty good place to cozy up n sleep.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionShelf) {
            System.out.println("you see a book shelf beside you.\n" +
                    "must try reading some of the classics.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionChair) {
            System.out.println("you see a chair beside you.\n" +
                    "something super obvious written hear");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionCloset) {
            System.out.println("you see an antique closet beside you.\n" +
                    "very mysterious...who knows whats inside it.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionCushion) {
            System.out.println("you see giant cushion.\n" +
                    "this must act as a good mean to reduce impact of ground when things fall.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionDine) {
            System.out.println("you see a dining table beside you.\n" +
                    "its pretty useless cause you don't know how to cook.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionPC) {
            System.out.println("you see a PC beside you.\n" +
                    "should try turning it on.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionShoeRack) {
            System.out.println("you see a shoe rack beside you.\n" +
                    "try opening it.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionShowCase) {
            System.out.println("you see an antique show case.\n" +
                    "it appears locked.something useful must be in there.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionSofa) {
            System.out.println("you see a sofa.\n" +
                    "a good place to scooch in.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionTable) {
            System.out.println("you see a study table beside you.\n" +
                    " do whatever you can.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionTV) {
            System.out.println("A TV.\n" +
                    "but first you must find its remote.");
            System.out.println();
        }
        if (getNewPosition(position, initials) == SectorPositionDoor1) {
            System.out.println("you see a door.\n" +
                    "          Duh!");
            System.out.println();
        }
        if (getNewPosition(position, initials) == SectorPositionDoor2) {
            System.out.println("you see a door.\n" +
                    "          Duh!");
            System.out.println();
        }
        if (getNewPosition(position, initials) == SectorPositionDoor3) {
            System.out.println("you see a door.\n" +
                    "          Duh!");
            System.out.println();
        }
        if (getNewPosition(position, initials) == SectorPositionDoor4) {
            System.out.println("you see a door.\n" +
                    "          Duh!");
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionHell) {
            Hell hell = new Hell();
            hell.enterHell();
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionBathroom) {
            Bathroom bathroom = new Bathroom();
            bathroom.useBathroom();
            System.out.println();
        }
        if (getNewPosition(position, initials) == positionKitchen) {
            Kitchen kitchen = new Kitchen();
            kitchen.enterKitchen();
            System.out.println();
        }
    }

    public static String getDirectionOfInitials(String initials){
        switch(initials) {
            case "n":
                return "north";
            case "ne":
                return "northeast";
            case "nw":
                return "northwest";
            case "e":
                return "east";
            case "w":
                return "west";
            case "s":
                return "south";
            case "se":
                return "southeast";
            case "sw":
                return "southwest";
            default:
                System.out.println("problem with initials.\n" +
                        "pls contact OM TANK.");
                return null;
        }
    }

    public static void setYou() {
        you3=blank;
        you7=blank;
        you8=blank;
        you9=blank;
        you11=blank;
        you12=blank;
        you13=blank;
        you14=blank;
        you15=blank;
        you17=blank;
        you18=blank;
        you19=blank;
        you23=blank;
        switch (You.position){
            case 3:
                you3=you;
                break;
            case 7:
                you7=you;
                break;
            case 8:
                you8=you;
                break;
            case 9:
                you9=you;
                break;
            case 11:
                you11=you;
                break;
            case 12:
                you12=you;
                break;
            case 13:
                you13=you;
                break;
            case 14:
                you14=you;
                break;
            case 15:
                you15=you;
                break;
            case 17:
                you17=you;
                break;
            case 18:
                you18=you;
                break;
            case 19:
                you19=you;
                break;
            case 23:
                you23=you;
                break;
            default:
                System.out.println("technically you are out of bounds.\n" +
                        "don't know how has this happened.\n" +
                        "so pls contact OM TANK.");
        }
    }

//go end
//
//sit start
    public static boolean besideBed;
    public static boolean besideChair;
    public static boolean besideCushion;
    public static boolean besideDine;
    public static boolean besideSofa;
    public static boolean besideStudy;
    public static boolean besideNothingToSit;

    public static void setSittingParameters() {
        besideBed = You.position == Bed.position;
        besideChair = You.position == Chair.position;
        besideCushion = You.position == Cushion.position;
        besideDine = You.position == DiningTable.position;
        besideSofa = You.position == Sofa.position;
        besideStudy = You.position == StudyTable.position;
        besideNothingToSit = !besideBed && !besideStudy && !besideSofa && !besideChair && !besideCushion && !besideDine;
    }

    public static void typeSittingSuggestions() {
        setSittingParameters();
        if (besideNothingToSit) {
            System.out.println("you are close to nothing that you can sit on.\n" +
                    "please create or go stay beside the object that you want to sit on. ");
        }
        if (besideBed) {
            System.out.print("bed?, (type 'bed')");
        }
        if (besideStudy) {
            System.out.print("study table?(type 'study'), ");
        }
        if (besideSofa) {
            System.out.println("sofa?, (type 'sofa')");
        }
        if (besideDine) {
            System.out.print("dining table?(type 'dine'), ");
        }
        if (besideCushion) {
            System.out.print("cushion?, (type 'cushion')");
        }
        if (besideChair) {
            System.out.print("chair? (type 'chair')");
        }
    }

//sit end
//
//open start
    public static boolean besideBookshelf;
    public static boolean besideCloset;
    public static boolean besideShoeRack;
    public static boolean besideShowCase;
    public static boolean besideDoor1;
    public static boolean besideDoor2;
    public static boolean besideDoor3;
    public static boolean besideDoor4;
    public static boolean besideNothingToOpen;
    public static boolean nothingToOpenButDoor;

    public static void setOpeningParameters() {
        besideBookshelf=You.position== BookShelf.position;
        besideCloset=You.position==Closet.position;
        besideShoeRack=You.position==ShoeRack.position;
        besideShowCase=You.position==ShowCase.position;
        besideDoor1=You.position==Door1.sectorPosition;
        besideDoor2=You.position==Door2.sectorPosition;
        besideDoor3=You.position==Door3.sectorPosition;
        besideDoor4=You.position==Door4.sectorPosition;
        nothingToOpenButDoor= !besideBookshelf&&!besideCloset&&!besideShowCase&&!besideShoeRack;
        besideNothingToOpen= !(You.position ==BookShelf.position) &&!(You.position==Closet.position)&&!(You.position==ShoeRack.position)&&!(You.position==ShowCase.position)&&!(You.position==Door1.position)&&!(You.position==Door2.position)&&!(You.position==Door3.position)&&(You.position==Door4.position);
    }

    public static void typeOpeningSuggestions() {
        setOpeningParameters();
        if (besideNothingToOpen) {
            System.out.println("you are close to nothing that you can open");
        }
        if (besideBookshelf) {
            System.out.println("bookshelf? (type 'shelf')");
        }
        if (besideCloset) {
            System.out.println("closet? (type 'closet')");
        }
        if (besideShoeRack) {
            System.out.println("ShoeRack? (type 'shoeRack')");
        }
        if (besideShowCase) {
            System.out.println("showcase? (type 'showCase')");
        }
        if (besideDoor1||besideDoor2||besideDoor3||besideDoor4) {
            System.out.println("door? (type 'door')");
        }
    }

    //open end
//
//close start
    public static boolean besideNothingToClose;

    public static void setClosingParameters() {
        besideDoor1=You.position==Door1.sectorPosition;
        besideDoor2=You.position==Door2.sectorPosition;
        besideDoor3=You.position==Door3.sectorPosition;
        besideDoor4=You.position==Door4.sectorPosition;
        besideNothingToClose=!besideDoor1&&!besideDoor2&&!besideDoor3&&!besideDoor4;
    }

    public static void typeClosingSuggestions() {
        setClosingParameters();
        if (besideNothingToClose){
            System.out.println("you are beside nothing to that you can close");
        }
        if (besideDoor1||besideDoor2||besideDoor3|besideDoor4) {
            System.out.println("door? (type'door')");
        }
    }

    public static void closeDoors() {
        if (You.position==Door1.sectorPosition||You.position== Door2.sectorPosition||You.position== Door3.sectorPosition||You.position== Door4.sectorPosition){
            if (You.position==Door1.sectorPosition){
                Door1.closeDoor();
            }
            if (You.position==Door2.sectorPosition){
                Door2.closeDoor();
            }
            if (You.position==Door3.sectorPosition) {
                Door3.closeDoor();
            }
            if (You.position==Door4.sectorPosition) {
                Door4.closeDoor();
            }
        }else {
            System.out.println("you need to be standing beside a door to close it");
        }
    }
    //close end
    //
    //turn start
    public static boolean besidePC;
    public static boolean besideTV;
    public static boolean besideTap;
    public static boolean besideLamp;
    public static boolean besideShowKey;
    public static boolean besideHellKey;
    public static boolean besideNothingToTurn;
    public static boolean nothingToTurnButKey;

    public static void setTurningParameters() {
        besideLamp=You.position==Lamp.position;
        besideTV= You.position == TV.sectorPosition;
        besidePC= You.position == PC.position;
        besideTap=You.position==Bathroom.position;
        besideChair = You.position == Chair.position;
        besideHellKey=You.position==HellKey.position;
        besideShowKey=You.position==ShowKey.position;
        nothingToTurnButKey =(!besideTV&&!besideLamp&&!besidePC&&!besideTap&&!besideChair)&&(You.haveHellKeys||You.haveShowKeys);
        besideNothingToTurn= !besideChair && !besideLamp && !You.haveHellKeys && !You.haveShowKeys && !besideTV && !besidePC && !besideDoor1 && !besideDoor2 && !besideDoor3 && !besideDoor4;
    }

    public static void typeTurningSuggestions () {
        setTurningParameters();
        if (besideNothingToTurn) {
            System.out.println("Neither you have anything to turn.\n" +
                    "nor you are close to anything that you can turn/turn on");
        }

        if (nothingToTurnButKey) {
            System.out.println("to turn any key .pls put it in a lock first\n" +
                    "you can type 'put' to put when you are beside a lock.");
        }
        if (besideLamp){
            System.out.println("lamp? (type 'lamp')");
        }
        if (besidePC){
            System.out.println("PC? (type 'PC')");
        }
        if (besideTV){
            System.out.println("TV? (type 'TV')");
        }
        if (besideTap){
            System.out.println("Tap? (type 'tap')");
        }
        if (You.haveShowKeys||You.haveHellKeys) {
            System.out.println("if you want to turn any key,\n" +
                    "type 'put' while standing beside the thing you want to put the key in.");
        } else if ((ShowKey.showKeyPut && besideShowKey)||(HellKey.hellKeyPut && besideHellKey)) {
            System.out.println("Key? (type 'key')");
        }
        if (besideChair && You.sitting){
            System.out.println("please stand if you want to turn the chair to turn the chair");
        }else if (besideChair){
            System.out.println("Chair? (type 'chair')");
        }
    }
    //turn end
    //
    //sleep start

    public static void setSleepingParameters() {
        besideBed= You.position == Bed.position;
        besideSofa=You.position==Sofa.position;
    }

    public static void typeSleepingSuggestions() {
        setSleepingParameters();
        if (besideBed){
            System.out.println("bed? (type 'bed')");
        }
        if (besideSofa) {
            System.out.println("sofa? (type 'sofa')");
        }
        System.out.println("floor? (type 'floor')");
    }
}
