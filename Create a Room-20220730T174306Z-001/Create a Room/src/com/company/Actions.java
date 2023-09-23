package com.company;

import com.company.Objects.*;
import com.company.RoomsNDoors.*;

import java.util.Scanner;

public class Actions {
    public static String v_1;

    public static void create(String thing,String positionInitials) {
        Scanner scanner = new Scanner(System.in);
        if(thing==null) {
            System.out.println("what do you want to create:");
            System.out.println("bathroom,kitchen,hell,\n" +
                    "door,TV,\n" +
                    "Study table(type table),sofa,showcase,shoeRack,PC,lamp,DiningTable(type dine),cushion,closet,chair,bed, or book shelf(type shelf)");
        }
            if (thing==null){
                v_1 = scanner.nextLine().toLowerCase();
            }else {
                v_1=thing;
            }
        switch (v_1) {
            case "cancel":
                break;
            case "bathroom":
                Base.OUTCreateMap(12,positionInitials);
                break;
            case "hell":
                Base.OUTCreateMap(17,positionInitials);
                break;
            case "door":
                Base.WALLCreateMap(16,positionInitials);
                break;
            case "kitchen":
                Base.OUTCreateMap(18,positionInitials);
                break;
            case "bed":
                Base.INCreateMap(1,positionInitials);
                break;
            case "shelf":
                Base.INCreateMap(2,positionInitials);
                break;
            case "chair":
                Base.INCreateMap(3,positionInitials);
                break;
            case "closet":
                Base.INCreateMap(4,positionInitials);
                break;
            case "dine":
                Base.INCreateMap(5,positionInitials);
                break;
            case "pc":
                Base.INCreateMap(6,positionInitials);
                break;
            case "shoerack":
                Base.INCreateMap(7,positionInitials);
                break;
            case "showcase":
                Base.INCreateMap(8,positionInitials);
                break;
            case "sofa":
                Base.INCreateMap(9,positionInitials);
                break;
            case "table":
                Base.INCreateMap(10,positionInitials);
                break;
            case "cushion":
                Base.INCreateMap(19,positionInitials);
                break;
            case "tv":
            case "television":
                Base.WALLCreateMap(11,positionInitials);
                break;
            case "lamp":
                System.out.println("mysteriously a lamp dropped from the sky and fell right on your hands.\n" +
                        "you caught it.\n" +
                        "its made of glass.you should be careful");
                Lamp.position = You.position;
                You.haveLamp = true;
                break;
            default:
                System.out.println("please check your spelling and try again.");
                System.out.println("if still not working,pls contact Om Tank");
        }
    }

    public static void go(String directionInitials) {
        int oldPosition = You.position;
        String initials;
        if (!You.sitting) {
            if (You.haveLamp) {
                if (Lamp.lampOn) {
                    if(directionInitials==null){
                        Scanner scanner = new Scanner(System.in);
                        System.out.println("where do you want to go...");
                        System.out.println("type N,NE,E,SE,W,NW,NE, or S.");
                        initials = scanner.nextLine().toLowerCase();
                    }else {
                        initials=directionInitials;
                    }
                    if (Base.movementEvaluator(oldPosition, initials)) {
                        You.position = Base.getNewPosition(oldPosition, initials);
                        Lamp.position = Base.getNewPosition(oldPosition, initials);
                        if (You.haveHellKeys) {
                            HellKey.position = Base.getNewPosition(oldPosition, initials);
                        }
                        if (You.haveShowKeys) {
                            ShowKey.position = Base.getNewPosition(oldPosition, initials);
                        }
                        Base.setYou();
                        System.out.println("you went " + Base.getDirectionOfInitials(initials));
                        System.out.println();
                        Base.examineSurrounding(oldPosition, initials);
                        System.out.println();
                        Base.examinePosition(oldPosition, initials);
                    }
                } else {
                    System.out.println("you are too scared to go anywhere without light.\n" +
                            "type 'turn' to turn on the lamp.");
                }
            } else {
                System.out.println("you are too scared to go anywhere without your lamp.\n" +
                        "maybe creating something might help");
            }
        } else {
            System.out.println("please stand to go somewhere.");
        }
    }

    public static void sit() {
        Scanner scanner = new Scanner(System.in);
        if (!You.sitting) {
            System.out.println("what would you like to sit on.\n");
            Base.typeSittingSuggestions();
            if (!Base.besideNothingToSit) {
                switch (scanner.nextLine().toLowerCase()) {
                    case "bed":
                        if (Base.besideBed) {
                            Bed bed = new Bed();
                            bed.sitOnBed();
                        } else {
                            System.out.println("please be near a bed to sit on it");
                        }
                        break;
                    case "chair":
                        if (Base.besideChair) {
                            Chair chair = new Chair();
                            chair.sitOnChair();
                        } else {
                            System.out.println("please be near a chair to sit on it");
                        }
                        break;
                    case "cushion":
                        if (Base.besideCushion) {
                            Cushion cushion = new Cushion();
                            cushion.sitOnCushion();
                        } else {
                            System.out.println("please be near a cushion to sit on it");
                        }
                        break;
                    case "dine":
                        if (Base.besideDine) {
                            DiningTable diningTable = new DiningTable();
                            diningTable.sitOnDine();
                        } else {
                            System.out.println("please be near the dining table to sit on it.");
                        }
                        break;
                    case "sofa":
                        if (Base.besideSofa) {
                            Sofa sofa = new Sofa();
                            sofa.sitOnSofa();
                        } else {
                            System.out.println("please be near a sofa to sit on it.");
                        }
                        break;
                    case "study":
                        if (Base.besideStudy) {
                            StudyTable studyTable = new StudyTable();
                            studyTable.sitOnTable();
                        } else {
                            System.out.println("please be near a the table to sit on it.");
                        }
                        break;
                    case "floor":
                        You.sitOnFloor();
                    default:
                        System.out.println("input not recognised.\n" +
                                "please try again.");
                }
            }
        }else {
            System.out.println("please stand to sit somewhere.");
        }
    }

    public static void sleep() {
        if (!Bathroom.showerTaken) {
            Scanner scanner=new Scanner(System.in);
            if (You.slept) {
                System.out.println("you have already slept enough.\n" +
                        "you are not feeling sleepy.");
            } else {
                Base.typeSleepingSuggestions();
                switch (scanner.nextLine().toLowerCase()) {
                    case "bed":
                        if (Base.besideBed) {
                            You.slept = true;
                            System.out.println("you lied down on the bed and took a nap.");
                            System.out.println("you woke up and now you are sitting on the bed");
                            You.sitting = true;
                        }else {
                            System.out.println("you are not beside the bed");
                        }
                        break;
                    case "sofa":
                        if (Base.besideSofa) {
                            You.slept=true;
                            System.out.println("you lied down on the sofa and took a nap.");
                            System.out.println("you woke up and now you are sitting on the bed");
                            You.sitting = true;
                        }else {
                            System.out.println("you are not beside a sofa");
                        }
                        break;
                    case "floor":
                        You.slept=true;
                        System.out.println("you lied down on the floor and took a nap.");
                        System.out.println("you woke up and now you are sitting on the bed");
                        You.sitting = true;
                        You.sittingOnFloor=true;
                        break;
                    default:
                        System.out.println("you were supposed to type one of the option(s)\n" +
                                "you can only sleep on the given suggestions.");
                }
            }
        }else{
            System.out.println("you had just taken a shower.\n" +
                    "you were not able to sleep.");
        }
    }

    public static void locate() {
        Base map = new Base();
        Base.setYou();
        map.printMap(0);
        switch (You.position) {
            case 7:
                System.out.println("you are in the north western part of the room.");
                break;
            case 8:
                System.out.println("you are in the northern part of the room.");
                break;
            case 9:
                System.out.println("you are in the north eastern part of the room.");
                break;
            case 12:
                System.out.println("you are in the western part of the room.");
                break;
            case 13:
                System.out.println("you are in the mid part of the room.");
                break;
            case 14:
                System.out.println("you are in the eastern part of the room.");
                break;
            case 17:
                System.out.println("you are in the south western part of the room.");
                break;
            case 18:
                System.out.println("you are in the southern part of the room.");
                break;
            case 19:
                System.out.println("you are in the south eastern part of the room.");
                break;
            case 3:
                System.out.println("you are in a room north of the main room.");
                break;
            case 11:
                System.out.println("you are in a room west of the main room.");
                break;
            case 15:
                System.out.println("you are in a room east of the main room.");
                break;
            case 23:
                System.out.println("you are in a room south of the main room.");
                break;
            default:
                System.out.println("error in print position.pls contact OM TANK");
        }
    }

    public static void open() {
        Scanner scanner = new Scanner(System.in);
        if (!Base.besideNothingToOpen) {
            if (You.sitting&&!You.sittingOnFloor) {
                System.out.println("you cant open while sitting on the floor or while standing.");
            }else {
                System.out.println("what would you like to open.");
                Base.typeOpeningSuggestions();
                switch (scanner.nextLine().toLowerCase()) {
                    case "shelf":
                        if (Base.besideBookshelf) {
                            BookShelf.openShelf();
                        }else {
                            System.out.println("pls stay beside the shelf to open any book.");
                        }
                        break;
                    case "closet":
                        if (Base.besideCloset){
                            Closet.openCloset();
                        }else {
                            System.out.println("pls stay beside the closet to open it");
                        }
                        break;
                    case "shoerack":
                        if (Base.besideShoeRack){
                            ShoeRack.openRack();
                        }else {
                            System.out.println("pls stay beside the shoe rack to open it");
                        }
                        break;
                    case "showcase":
                        if (Base.besideShowCase){
                            ShowCase.openCase();
                        }else {
                            System.out.println("pls stay beside the showcase to open it");
                        }
                        break;
                    case "door":
                        if (Base.besideDoor1){
                            Door1.openDoor();
                        }else if (Base.besideDoor2){
                            Door2.openDoor();
                        }else if(Base.besideDoor3) {
                            Door3.openDoor();
                        }else if(Base.besideDoor4) {
                            Door4.openDoor();
                        }else {
                            System.out.println("pls stay beside any door to open it.");
                        }
                        break;
                    default:
                        System.out.println("there is some spelling error.\n" +
                                "pls try again from open");
                }
            }
        }else{
            Base.typeOpeningSuggestions();
        }
    }

    public static void close() {
        if (You.sitting) {
            if (!You.sittingOnFloor) {
                System.out.println("pls stand or sit on floor to close anything");
                return;
            }

            if (!Base.besideNothingToClose) {
                Scanner scanner = new Scanner(System.in);
                if ("door".equals(scanner.nextLine().toLowerCase())) {
                    if (Base.besideDoor1) {
                        Door1.openDoor();
                    } else if (Base.besideDoor2) {
                        Door2.openDoor();
                    } else if (Base.besideDoor3) {
                        Door3.openDoor();
                    } else if (Base.besideDoor4) {
                        Door4.openDoor();
                    } else {
                        System.out.println("you are close to nothing that you can close");
                    }
                } else {
                    System.out.println("pls check your spelling and \n" +
                            "try again from close");
                }
            }else{
                Base.typeClosingSuggestions();
            }
        } else {
            if (!Base.besideNothingToClose) {
                Scanner scanner = new Scanner(System.in);
                if ("door".equals(scanner.nextLine().toLowerCase())) {
                    if (Base.besideDoor1) {
                        Door1.openDoor();
                    } else if (Base.besideDoor2) {
                        Door2.openDoor();
                    } else if (Base.besideDoor3) {
                        Door3.openDoor();
                    } else if (Base.besideDoor4) {
                        Door4.openDoor();
                    } else {
                        System.out.println("you are close to nothing that you can close");
                    }
                } else {
                    System.out.println("pls check your spellings \n" +
                            "and try again from close");
                }
            }else{
                Base.typeClosingSuggestions();
            }
        }
    }

    public static void turn() {
        if (!You.sitting){
            if (!Base.besideNothingToTurn){
                System.out.println("what would you like to turn/turn on");
                Base.typeTurningSuggestions();
                Scanner scanner =new Scanner(System.in);
                switch(scanner.nextLine().toLowerCase()){
                    case "pc":
                        if (Base.besidePC){
                            PC.usePC();
                        }else{
                            System.out.println("pls stay beside the PC to operate it");
                        }
                        break;
                    case "tv":
                        if (Base.besideTV){
                            TV.onTV();
                        }else{
                            System.out.println("pls stay beside the TV to operate it");
                        }
                        break;
                    case "tap":
                        if (Base.besideTap){
                            Bathroom.turnTap();
                        }else {
                            System.out.println("you need to go to the bathroom to turn the tap.");
                        }
                        break;
                    case "chair":
                        if (Base.besideChair){
                            Chair.turnChair();
                        }else { System.out.println("pls be beside chair to turn it");
                        }
                        break;
                    case "lamp":
                        if (Base.besideLamp){
                            Lamp.turnLamp();

                        }else {
                            System.out.println("you need to stay beside lamp to turn it on or off");
                        }
                        break;
                    case "Key":
                        if (ShowKey.showKeyPut&& Base.besideShowKey){
                            ShowKey.unlock();
                        }else if(HellKey.hellKeyPut&& Base.besideHellKey){
                            HellKey.unlock();
                        }else if(You.haveHellKeys || You.haveShowKeys){
                            System.out.println("to unlock anything\n" +
                                    "you need to put the key in a key hole first");
                        }else {
                            System.out.println("you don't have a key");
                        }
                }
            }else{
                Base.typeTurningSuggestions();
            }
        }else {
            System.out.println("you need to stand first");
        }
    }

    public static void search() {
        if(You.position==PC.position){
            if(!You.sitting || You.sittingOnFloor){
                System.out.println("you started searching.\n" +
                        "you were placing your hands on the floor around \n" +
                        "\n" +
                        "after 5 mins of searching,\n" +
                        "You found a INVISIBLE KEY!!!\n" +
                        "you picked it up.");
                You.haveShowKeys=true;
            }else {
                System.out.println("you need to stand");
            }
        }else {
            System.out.println("you started searching.\n" +
                    "you were placing your hands on the floor around \n" +
                    "\n" +
                    "after 5 mins of searching,\n" +
                    "you found nothing...\n" +
                    "you quit searching");
        }
    }

    public static void printKey() {
        System.out.println("                     KEY\n" );
        System.out.println("type 'create' to create anything");
        System.out.println("type 'go' to move");
        System.out.println("type 'locate' to find where you are");
        System.out.println("type 'open' to open stuff(when you are beside them)");
        System.out.println("type 'close' to close stuff");
        System.out.println("type 'put' to put stuff on the GROUND");
        System.out.println("type 'pick' to pick up stuff from the GROUND");
        System.out.println("type 'turn' to turn on or rotate something.");
        System.out.println("type 'sit' to sit on any object");
        System.out.println("type 'sleep' to sleep on stuff");
        System.out.println("type 'stand' to stand.\n");
        System.out.println("type 'key' to PRINT THIS KEY.\n");
        System.out.println("type 'end' to end the simulation (your progress will not be saved)");
    }

    public static void pickUp() {
        Scanner scanner=new Scanner(System.in);
        System.out.println("what would you like to pick up?");
        if (You.haveLamp){
            System.out.println("lamp? (type 'lamp')");
            if ("lamp".equals(scanner.nextLine().toLowerCase())) {
                You.pickUpLamp();
            } else {
                System.out.println("here, you were supposed to type stuff you want to pick up\n" +
                        "you can only pick up stuff that is available in the options");
            }
        }else {
            System.out.println("you aren't close to anything you can pick up");
        }
    }

    public static void put() {
        Scanner scanner=new Scanner(System.in);
        if (!You.haveLamp){
            System.out.println("what would you to put on the floor");
            System.out.println("lamp? (type 'lamp')");
            if ("lamp".equals(scanner.next().toLowerCase())){
                You.dropLamp();
            }else {
                System.out.println("here, you were supposed to type something that you can put on floor\n" +
                        "you can only put stuff that are availed in the options");
            }
        }else {
            System.out.println("you don't have anything that you can put on floor\n" +
                    "(you CAN'T put keys as this simulation doesn't have that feature.");
        }
    }
}
