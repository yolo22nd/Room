package com.company;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner=new Scanner(System.in);
        System.out.println("here goes the story...\n" +
                "\n" +
                "You, a WIZARD, just a newbie\n" +
                "took up a battle to death with one of the best witches in your world...\n" +
               "press enter to continue...");
        scanner.nextLine();
        System.out.println("obviously, you were defeated and,\n" +
                "when the witch was about to KILL YOU with her final spell,\n" +
                "you begged for mercy...\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("being merciful, she instead banished you to a place beyond hell,\n" +
                "the place was a room,in order to travel back to the world of living,\n" +
                "you will literally need to go through hell.\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("here is the good news of her being merciful,\n" +
                "you WEREN'T stripped of your powers.\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("so the main objective is:\n" +
                "GO  TO  HELL!!!\n" +
               "press enter to continue...");
        scanner.nextLine();
        Actions.locate();
        System.out.println("this is the map of the room.\n" +
                "press enter to continue...");
        scanner.nextLine();
        Actions.printKey();
        System.out.println();
        System.out.println("this is the Key.");
        System.out.println("what would you like to do ???");
        label:
        while (true){
//general start
            boolean createInput=false;
            boolean goInput=false;
            boolean keyInput=false;
            boolean locateInput=false;
            boolean turnInput=false;
            boolean pickInput=false;
            boolean putInput=false;
            boolean closeInput=false;
            boolean openInput=false;
            boolean searchInput=false;
            boolean sitInput=false;
            boolean standInput=false;
            boolean sleepInput=false;
            boolean endInput=false;
//general end
//
//create start
            String thing=null;
            boolean thingInput=false;
            boolean bathroomInput=false;
            boolean kitchenInput=false;
            boolean hellInput=false;
            boolean doorInput=false;
            boolean TVInput=false;
            boolean tableInput=false;
            boolean sofaInput=false;
            boolean showcaseInput=false;
            boolean shoeRackInput=false;
            boolean PCInput=false;
            boolean lampInput=false;
            boolean dineInput=false;
            boolean cushionInput=false;
            boolean closetInput=false;
            boolean chairInput=false;
            boolean bedInput=false;
            boolean shelfInput=false;
//create end
//
//direction start
            String directionInitials=null;
            boolean directionInput=false;
            boolean middleInput=false;
            boolean northInput=false;
            boolean southInput=false;
            boolean eastInput=false;
            boolean westInput=false;
            boolean northEastInput=false;
            boolean northWestInput=false;
            boolean southEastInput=false;
            boolean southWestInput=false;
//direction end
//
//sit start
            boolean floorInput=false;
//sit end
//
//turn start
            boolean tapInput=false;
//turn end

            String input =scanner.nextLine().toLowerCase();
            String[] commands=input.split(" ");
            for(int i=0;i<commands.length;i++){
                String word=commands[i];
                if(word.equals("create")){
                    createInput=true;
                }
                if(word.equals("go")){
                    goInput=true;
                }
                if(word.equals("key")){
                    keyInput=true;
                }
                if(word.equals("locate")){
                    locateInput=true;
                }
                if(word.equals("turn")){
                    turnInput=true;
                }
                if(word.equals("pick")){
                    pickInput=true;
                }
                if(word.equals("put")){
                    putInput=true;
                }
                if(word.equals("close")){
                    closeInput=true;
                    //close command hasnt been made yet
                }
                if(word.equals("open")){
                    openInput=true;
                }
                if(word.equals("search")){
                    searchInput=true;
                }
                if(word.equals("sit")){
                    sitInput=true;
                }
                if(word.equals("stand")){
                    standInput=true;
                }
                if(word.equals("sleep")){
                    sleepInput=true;
                }
                if(word.equals("end")){
                    endInput=true;
                }
                if(word.equals("bathroom")){
                    bathroomInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("kitchen")){
                    kitchenInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("hell")){
                    hellInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("door")){
                    doorInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("tv")){
                    TVInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("table")){
                    tableInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("sofa")){
                    sofaInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("showcase")){
                    showcaseInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("shoerack")){
                    shoeRackInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("pc")){
                    PCInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("lamp")){
                    lampInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("dine")){
                    dineInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("cushion")){
                    cushionInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("closet")){
                    closetInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("chair")){
                    chairInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("bed")){
                    bedInput=true;
                    thingInput=true;
                    thing=word;
                }
                if(word.equals("shelf")){
                    shelfInput=true;
                    thingInput=true;
                    thing=word;
                }
//
//
//
                if(word.equals("middle")||word.equals("mid")||word.equals("m")){
                    middleInput=true;
                    directionInput=true;
                    directionInitials="m";
                }
                if (word.equals("north")||word.equals("n")){
                    northInput=true;
                    directionInput=true;
                    directionInitials="n";
                }
                if(word.equals("south")||word.equals("s")){
                    southInput=true;
                    directionInput=true;
                    directionInitials="s";
                }
                if(word.equals("east")||word.equals("e")){
                    eastInput=true;
                    directionInput=true;
                    if (northInput) {
                        directionInitials = "ne";
                    } else if (southInput) {
                        directionInitials = "se";
                    } else {
                        directionInitials = "e";
                    }
                }
                if(word.equals("west")||word.equals("w")){
                    westInput=true;
                    directionInput=true;
                    if (northInput) {
                        directionInitials = "nw";
                    } else if (southInput) {
                        directionInitials = "sw";
                    } else {
                        directionInitials = "w";
                    }
                }
                if(word.equals("northeast")||word.equals("ne")){
                    northEastInput=true;
                    directionInput=true;
                    directionInitials="nw";
                }
                if(word.equals("northwest")||word.equals("nw")){
                    northWestInput=true;
                    directionInput=true;
                    directionInitials="nw";
                }
                if(word.equals("southeast")||word.equals("se")){
                    southEastInput=true;
                    directionInput=true;
                    directionInitials="se";
                }
                if(word.equals("southwest")||word.equals("sw")){
                    southWestInput=true;
                    directionInput=true;
                    directionInitials="sw";
                }
                if(word.equals("floor")){
                    floorInput=true;
                }
                if(word.equals("tap")){
                    tapInput=true;
                }
            }
            //changes hav been made in the create method....rest are remaining...ready for trial in create method after on check in the flow.
            //date:27/01/2021
            if (createInput) {
                Actions.create(thing, directionInitials);
            } else if (goInput) {
                Actions.go(directionInitials);
            } else if (keyInput) {
                Actions.printKey();
            } else if (locateInput) {
                Actions.locate();
            } else if (turnInput) {
                Actions.turn();
            } else if (pickInput) {
                Actions.pickUp();
            } else if (putInput) {
                Actions.put();
            } else if (closeInput) {
                Actions.close();
            } else if (openInput) {
                Actions.open();
            } else if (searchInput) {
                Actions.search();
            } else if (sitInput) {
                Actions.sit();
            } else if (sleepInput) {
                Actions.sleep();
            } else if (endInput) {
                System.out.println("are you sure you want to end this simulation??????");
                if ("yes".equals(scanner.nextLine().toLowerCase())) {
                    break label;
                } else {
                    System.out.println("simulation continued");
                }
            } else if (standInput) {
                You.stand();
            } else {
                System.out.println("whatever you typed was not registered.");
                System.out.println("you were supposed to type 'create', 'go', 'open', etc. here.");
            }
            if (You.dead){
                break;
            }
            if (You.won){
                break;
            }
        }
        if (You.dead){
            System.out.println("You died");
        }
        if (You.won){
            System.out.println("await for the next part!!!!!\n" +
                    "AND write reviews of the game at omtank22@gmail.com");
        }
        System.out.println("simulation ended.");
    }


}
